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