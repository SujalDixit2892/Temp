import { getEnergyAnalysis, getMaintenanceAssets, getOccupancyAnalysis } from "./api.js";
import { loadFacilitySelector } from "./facilities.js";

let performanceChart;
let resourceChart;
const $ = id => document.getElementById(id);
const text = (value, fallback = "--") => value == null || value === "" ? fallback : String(value);
const escape = value => text(value).replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[character]));

function setMetric(id, value, visible = value != null) {
    const metric = $(id)?.closest(".metric");
    if (metric) metric.hidden = !visible;
    if ($(id)) $(id).textContent = text(value);
}

function latestTimestamp(snapshot) {
    const values = [
        ...(snapshot.energy?.analysis?.history || []).map(item => item.date),
        ...(snapshot.maintenance?.assets || []).map(item => item.as_of),
        ...(snapshot.security?.events || []).map(item => item.event_time || item.timestamp)
    ].filter(Boolean).sort();
    return values.at(-1);
}

function renderCharts(snapshot) {
    const history = snapshot.energy?.analysis?.history || [];
    const energyPanel = $("performanceChart").closest(".panel");
    energyPanel.hidden = !history.length;
    if (performanceChart) performanceChart.destroy();
    if (history.length && globalThis.Chart) {
        const expected = history.some(item => item.predicted_kwh != null);
        performanceChart = new Chart($("performanceChart"), { type: "line", data: { labels: history.map(item => item.date), datasets: [
            { label: "Actual kWh", data: history.map(item => item.actual_kwh), borderColor: "#65c99b", tension: .3 },
            ...(expected ? [{ label: "Expected kWh", data: history.map(item => item.predicted_kwh), borderColor: "#8e99a8", borderDash: [5, 4], tension: .3 }] : [])
        ] }, options: { responsive: true, maintainAspectRatio: false } });
    }

    const assets = snapshot.maintenance?.assets || [];
    const counts = { Healthy: 0, Warning: 0, Critical: 0 };
    assets.forEach(asset => { const score = Number(asset.health_score); counts[asset.high_risk ? "Critical" : score >= 80 ? "Healthy" : "Warning"]++; });
    const assetPanel = $("resourceChart").closest(".panel");
    assetPanel.hidden = !assets.length;
    if (resourceChart) resourceChart.destroy();
    if (assets.length && globalThis.Chart) resourceChart = new Chart($("resourceChart"), { type: "doughnut", data: { labels: Object.keys(counts), datasets: [{ data: Object.values(counts), backgroundColor: ["#65c99b", "#e4b45d", "#e56b6f"] }] }, options: { responsive: true, maintainAspectRatio: false } });
    $("maintenanceHealth").innerHTML = assets.length ? `<table class="report-table"><thead><tr><th>STATUS</th><th>ASSETS</th></tr></thead><tbody>${Object.entries(counts).map(([label, count]) => `<tr><td>${label}</td><td>${count}</td></tr>`).join("")}</tbody></table>` : "";
}

function renderOccupancy(occupancy) {
    const zones = occupancy?.zones || [];
    const values = zones.map(zone => Number(zone.utilization_pct)).filter(Number.isFinite);
    $("agentPerformance").innerHTML = values.length ? `<table class="report-table"><thead><tr><th>ZONE</th><th>UTILIZATION</th></tr></thead><tbody>${zones.filter(zone => zone.utilization_pct != null).map(zone => `<tr><td>${escape(zone.zone_id)}</td><td>${zone.utilization_pct}%</td></tr>`).join("")}</tbody></table>` : `<p class="report-note">Occupancy utilization is unavailable for this facility.</p>`;
    return values.length ? `${(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)}%` : null;
}

function renderSecurity(security) {
    const available = security && (security.total_events != null || security.threat_level || security.anomalies);
    $("riskOutlook").innerHTML = available ? `<div class="insight"><strong>Threat level: ${escape(security.threat_level)}</strong><br><br>Recorded events: ${text(security.total_events, "0")}<br>Active threats: ${security.active_threats?.length ?? 0}<br>Anomalies: ${security.anomalies?.length ?? 0}</div>` : `<p class="report-note">Security data is unavailable for this facility.</p>`;
}

function render(snapshot) {
    const history = snapshot.energy?.analysis?.history || [];
    const avgOccupancy = renderOccupancy(snapshot.occupancy);
    const totalEnergy = history.reduce((sum, item) => sum + Number(item.actual_kwh || 0), 0);
    setMetric("energy", history.length ? `${totalEnergy.toLocaleString()} kWh` : null, history.length > 0);
    setMetric("asset", snapshot.maintenance?.summary?.facility_health_score, snapshot.maintenance?.summary?.facility_health_score != null);
    setMetric("risk", null, false);
    setMetric("savings", null, false);
    setMetric("cost", null, false);
    if (avgOccupancy != null && !$("occupancyMetric")) {
        $("asset").closest(".metric").insertAdjacentHTML("afterend", `<div id="occupancyMetric" class="metric"><span class="metric-label">OCCUPANCY UTILIZATION</span><strong class="metric-value">${avgOccupancy}</strong><span class="metric-sub">Current zone average</span></div>`);
    }
    renderCharts(snapshot);
    renderSecurity(snapshot.security);
    const recommendation = snapshot.recommendation?.text || snapshot.energy?.recommendation?.text;
    $("executiveSummary").innerHTML = `<div class="ai-output-header"><span>${escape(snapshot.recommendation?.source || "FACILITY INTELLIGENCE")}</span><span class="result-status">${recommendation ? "AVAILABLE" : "UNAVAILABLE"}</span></div><div class="ai-output-body">${escape(recommendation || "No AI recommendation was returned for this facility.")}</div>`;
    const financialText = snapshot.energy?.recommendation?.text;
    $("financialPanel").hidden = !financialText;
    if (financialText) $("financialImpact").innerHTML = `<div class="insight"><strong>Energy optimization recommendation</strong><br><br>${escape(financialText)}</div>`;
    $("reportTimestamp").textContent = text(latestTimestamp(snapshot));
    $("reportDataStatus").textContent = "LIVE RESPONSES";
}

async function refresh() {
    const facility = $("facility").value;
    const days = Number($("duration").value);
    if (!facility) return;
    $("reportFacility").textContent = $("facility").selectedOptions[0]?.textContent || facility;
    $("reportDuration").textContent = `${days} day${days === 1 ? "" : "s"}`;
    $("reportDataStatus").textContent = "LOADING";
    try {
        const [energy, maintenance, occupancyResult] = await Promise.all([getEnergyAnalysis(facility, days), getMaintenanceAssets(facility), getOccupancyAnalysis(facility, days)]);
        render({ energy, maintenance, occupancy: occupancyResult.occupancy, security: occupancyResult.security, recommendation: occupancyResult.recommendation });
    } catch (error) { console.error(error); $("reportDataStatus").textContent = "ERROR"; $("executiveSummary").textContent = `Unable to load report data: ${error.message}`; }
}

$("facility").addEventListener("change", refresh);
$("duration").addEventListener("change", refresh);
$("refreshReport").addEventListener("click", refresh);
$("generateReport").addEventListener("click", refresh);
$("printReport").addEventListener("click", () => globalThis.print());
loadFacilitySelector().then(refresh).catch(error => { console.error(error); $("reportDataStatus").textContent = "ERROR"; });
