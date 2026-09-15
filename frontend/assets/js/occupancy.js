import { loadFacilitySelector } from "./facilities.js";
import { getOccupancyAnalysis } from "./api.js";

const $ = id => document.getElementById(id);

async function initFacilities() {
    const facilities = await loadFacilitySelector();
    if (facilities.length) await analyze();
}

async function analyze() {

    const facility = $("facility").value;
    const days = Number($("duration").value);

    if (!facility) {
        clearResults();
        $("status").textContent = "WAITING";
        $("recommendation").textContent = "Select a facility to load occupancy analysis.";
        return;
    }

    $("status").textContent = "ANALYZING";
    $("recommendation").textContent =
        `Occupancy Agent is analyzing the last ${days} ${days === 1 ? "day" : "days"}...`;

    try {
        renderResult(await getOccupancyAnalysis(facility, days));

    } catch (error) {

        console.error(error);
        clearResults();
        $("status").textContent = "ERROR";
        $("recommendation").textContent = `Unable to load occupancy data: ${error.message}`;
    }
}

function renderResult(result) {

    const occupancy = result?.occupancy ?? {};
    const zones = Array.isArray(occupancy.zones) ? occupancy.zones : [];
    const days = Number(result?.analysis_window_days);

    $("assetCount").textContent = zones.length;

    const values = zones
        .map(z => Number(z.utilization_pct))
        .filter(Number.isFinite);

    const average = values.length
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null;

    $("healthScore").textContent =
        average == null ? "--" : `${average.toFixed(1)}%`;

    $("highRisk").textContent =
        zones.filter(z => z.status === "overcrowded").length;

    renderZones(zones);

    $("status").textContent = occupancy.degraded ? "DEGRADED" : "COMPLETE";
    $("recommendation").textContent =
        occupancy.degraded
            ? occupancy.degradation_reason ?? "Occupancy model is unavailable; showing degraded zone data."
            : `${result.recommendation?.text ?? result.recommendation ?? "Occupancy analysis completed."} ` +
                (Number.isFinite(days) ? `Window: last ${days} ${days === 1 ? "day" : "days"}.` : "");
    renderOccupancyDashboard(zones, values, average, occupancy);
}

function renderOccupancyDashboard(zones, values, average, occupancy) {
    const ranked = zones
        .map(zone => ({ zone, utilization: Number(zone.utilization_pct) }))
        .filter(item => Number.isFinite(item.utilization))
        .sort((a, b) => b.utilization - a.utilization);

    $("zoneRanking").innerHTML = ranked.length
        ? ranked.map(({ zone, utilization }) => {
            const label = zone.zone_type ?? zone.zone_id ?? "Zone";
            return `<div class="zone-rank"><div class="zone-rank-top"><strong>${escapeHtml(label)}</strong><span>${utilization.toFixed(1)}%</span></div><div class="zone-progress"><i class="${getIntensity(utilization)}" style="width:${Math.min(utilization, 100)}%"></i><b style="left:75%"></b><b style="left:100%"></b></div><span class="zone-rank-status">${getIntensity(utilization).toUpperCase()} UTILIZATION</span></div>`;
        }).join("")
        : `<div class="insight">No utilization data returned.</div>`;

    const counts = zones.map(zone => Number(zone.latest_count)).filter(Number.isFinite);
    const capacities = zones.map(zone => Number(zone.max_capacity)).filter(Number.isFinite);
    const totalCount = counts.reduce((a, b) => a + b, 0);
    const totalCapacity = capacities.reduce((a, b) => a + b, 0);
    const capacityPct = totalCapacity ? Math.min(totalCount / totalCapacity * 100, 100) : null;
    const highest = ranked[0];
    const riskBands = ["low", "normal", "high", "critical"].map(band => ({
        band,
        count: zones.filter(zone => getIntensity(Number(zone.utilization_pct)) === band).length
    }));
    $("capacityRisk").innerHTML = `<div class="capacity-gauge"><div class="gauge-value"><strong>${capacityPct == null ? "--" : `${capacityPct.toFixed(1)}%`}</strong><span>of total capacity</span></div><div class="gauge-track"><i style="width:${capacityPct ?? 0}%"></i></div><div class="gauge-scale"><span>${counts.length ? totalCount.toFixed(1) : "--"} occupied</span><span>${capacities.length ? totalCapacity.toFixed(1) : "--"} capacity</span></div></div><div class="risk-grid"><div><span>Average utilization</span><strong>${average == null ? "--" : `${average.toFixed(1)}%`}</strong></div><div><span>Highest-utilized zone</span><strong>${highest ? escapeHtml(highest.zone.zone_type ?? highest.zone.zone_id ?? "Zone") : "--"}</strong></div></div><div class="risk-distribution">${riskBands.map(({ band, count }) => `<div class="risk-band"><span>${band}</span><i class="${band}" style="width:${zones.length ? count / zones.length * 100 : 0}%"></i><b>${count}</b></div>`).join("")}</div>`;
    renderTrend(occupancy);
}

function renderTrend(occupancy) {
    const panel = $("occupancyTrendPanel");
    const series = occupancy.history ?? occupancy.time_series ?? occupancy.trend;
    if (!panel || !globalThis.Chart || !Array.isArray(series) || !series.length) {
        if (panel) panel.hidden = true;
        return;
    }
    panel.hidden = false;
    new globalThis.Chart($("occupancyTrendChart"), { type: "line", data: { labels: series.map(point => point.label ?? point.date ?? point.timestamp), datasets: [{ data: series.map(point => point.utilization_pct ?? point.occupancy), borderColor: "#65c99b", tension: .3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
}

function renderZones(zones) {

    $("assetList").innerHTML = zones.length
        ? zones.slice(0, 8).map(zone => `
            <div class="agent-row">
                <div class="agent-icon">O</div>
                <div class="agent-info">
                    <strong>
                        ${zone.zone_type ?? zone.zone_id ?? "Zone"}
                    </strong>
                    <span>
                        Average ${zone.latest_count ?? "--"} / ${zone.max_capacity ?? "--"}
                        (${zone.utilization_pct ?? "--"}%) · Expected ${zone.expected_count ?? "--"}
                    </span>
                </div>
                <span class="agent-state">
                    ${(zone.status ?? "MONITORED").toUpperCase()}
                </span>
            </div>
        `).join("")
        : `<div class="insight">No zone data returned.</div>`;

    renderHeatmap(zones);
}

function renderHeatmap(zones) {
    const heatmap = $("occupancyHeatmap");
    const timeBuckets = [...new Set(zones
        .map(zone => Number(zone.latest_hour))
        .filter(Number.isInteger)
    )].sort((a, b) => a - b);

    if (!zones.length || !timeBuckets.length) {
        heatmap.innerHTML = `<div class="heatmap-empty">No time-based occupancy data returned.</div>`;
        return;
    }

    const cells = zones.map(zone => {
        const zoneName = zone.zone_type ?? zone.zone_id ?? "Zone";
        const utilization = Number(zone.utilization_pct);
        const hour = Number(zone.latest_hour);
        const intensity = getIntensity(utilization);
        const occupancy = zone.latest_count ?? "--";
        const capacity = zone.max_capacity ?? "--";
        const status = zone.status ?? "no data";

        return `<div class="heatmap-row-label">${escapeHtml(zoneName)}</div>` +
            timeBuckets.map(bucket => bucket === hour
                ? `<button class="heat-cell ${intensity}" type="button"
                    aria-label="${escapeHtml(zoneName)} at ${formatHour(hour)}: ${occupancy} of ${capacity}, ${status}"
                    data-tooltip="${escapeHtml(`${zoneName} | ${formatHour(hour)} | Occupancy: ${occupancy} / ${capacity} | Status: ${status}`)}">
                    <span>${Number.isFinite(utilization) ? `${utilization.toFixed(0)}%` : "--"}</span>
                </button>`
                : `<div class="heat-cell empty" aria-hidden="true"></div>`
            ).join("");
    }).join("");

    heatmap.style.setProperty("--heatmap-columns", timeBuckets.length);
    heatmap.innerHTML = `<div class="heatmap-corner">ZONE / TIME</div>` +
        timeBuckets.map(hour => `<div class="heatmap-time">${formatHour(hour)}</div>`).join("") +
        cells + `<div class="heatmap-tooltip" role="status" aria-hidden="true"></div>`;

    const tooltip = heatmap.querySelector(".heatmap-tooltip");
    heatmap.querySelectorAll(".heat-cell:not(.empty)").forEach(cell => {
        cell.addEventListener("mouseenter", () => {
            tooltip.textContent = cell.dataset.tooltip;
            tooltip.setAttribute("aria-hidden", "false");
        });
        cell.addEventListener("mouseleave", () => tooltip.setAttribute("aria-hidden", "true"));
    });
}

function getIntensity(utilization) {
    if (!Number.isFinite(utilization)) return "empty";
    if (utilization >= 100) return "critical";
    if (utilization >= 75) return "high";
    if (utilization >= 30) return "normal";
    return "low";
}

function formatHour(hour) {
    return `${String(hour).padStart(2, "0")}:00`;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function clearResults() {
    $("assetCount").textContent = "--";
    $("healthScore").textContent = "--";
    $("highRisk").textContent = "--";
    $("predictedFailures").textContent = "--";
    $("assetList").innerHTML = `<div class="insight">No occupancy data available.</div>`;
    $("zoneRanking").innerHTML = `<div class="insight">No occupancy data available.</div>`;
    $("capacityRisk").innerHTML = `<div class="insight">No occupancy data available.</div>`;
    $("occupancyTrendPanel").hidden = true;

    $("occupancyHeatmap").innerHTML = `<div class="heatmap-empty">No occupancy data available.</div>`;
}

$("facility").addEventListener("change", analyze);
$("duration").addEventListener("change", analyze);

$("runTest").addEventListener("click", () => {

    $("testStatus").textContent = "SCENARIO READY";

    const occupancy = Number($("occupancy").value);
    const capacity = Number($("capacity").value);

    const utilization =
        capacity > 0
            ? (occupancy / capacity) * 100
            : 0;

    $("testResult").textContent =
        `Zone ${$("zone").value}: ${utilization.toFixed(1)}% utilization at ${$("time").value}.`;

    $("recommendation").textContent =
        utilization >= 90
            ? "High utilization scenario. Agent should evaluate overcrowding, HVAC demand and operational capacity."
            : utilization <= 30
                ? "Low utilization scenario. Agent should evaluate underutilized space and potential operating-hour optimization."
                : "Normal utilization scenario. Continue monitoring zone behavior.";

});

initFacilities().catch(error => {
    console.error(error);
    $("status").textContent = "BACKEND ERROR";
});