import { getEnergyAnalysis, getMaintenanceAssets, getOccupancyAnalysis } from "./api.js";
import { loadFacilitySelector } from "./facilities.js";

const $ = id => document.getElementById(id);

function text(value, fallback = "--") {
    return value == null || value === "" ? fallback : String(value);
}

function escape(value) {
    return text(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function statusClass(status) {
    return String(status).toLowerCase().replace(/\s+/g, "-");
}

function render(snapshot) {
    const { energy, maintenance, occupancy, security, recommendation } = snapshot;
    const energyAnalysis = energy?.analysis;
    const assets = Array.isArray(maintenance?.assets) ? maintenance.assets : [];
    const zones = Array.isArray(occupancy?.zones) ? occupancy.zones : [];
    const utilization = zones.map(zone => Number(zone.utilization_pct)).filter(Number.isFinite);
    const averageOccupancy = utilization.length
        ? `${(utilization.reduce((sum, value) => sum + value, 0) / utilization.length).toFixed(1)}%`
        : null;
    const highRiskAssets = assets.filter(asset => asset.high_risk === true).length;
    const securityThreats = Array.isArray(security?.active_threats) ? security.active_threats.length : null;
    const latestEnergy = [...(energyAnalysis?.history || []), ...(energyAnalysis?.anomalies || [])]
        .map(item => item.date).filter(Boolean).sort().at(-1);
    const latestMaintenance = assets.map(item => item.as_of).filter(Boolean).sort().at(-1);
    const latestSecurity = security?.events?.map(item => item.event_time || item.timestamp).filter(Boolean).sort().at(-1);
    const energyFinding = energyAnalysis?.history?.length
        ? `${energyAnalysis.history.length} telemetry points${energyAnalysis.forecast_next_day_kwh == null ? " · forecast unavailable" : ""}`
        : energy?.degraded ? energy.degradation_reason : energyAnalysis?.anomalies?.length
        ? `${energyAnalysis.anomalies.length} anomaly day(s)` : energyAnalysis?.forecast_next_day_kwh != null
            ? `Forecast ${energyAnalysis.forecast_next_day_kwh} kWh` : null;
    const maintenanceFinding = maintenance?.degraded ? maintenance.degradation_reason : maintenance?.summary?.high_risk_count != null
        ? `${maintenance.summary.high_risk_count} high-risk asset(s)` : null;
    const occupancyFinding = occupancy?.degraded ? occupancy.degradation_reason : averageOccupancy
        ? `${averageOccupancy} average utilization` : null;
    const securityFinding = security?.threat_level
        ? `${security.threat_level} threat level` : security?.total_events != null
            ? `${security.total_events} recorded event(s)` : null;
    const agents = [
        ["E", "Energy", energy, energyFinding, energyAnalysis?.status === "success" ? "ANALYZED" : energy?.degraded ? "DEGRADED" : "UNAVAILABLE", latestEnergy],
        ["M", "Maintenance", maintenance, maintenanceFinding, maintenance?.degraded ? "DEGRADED" : maintenance?.summary ? "ANALYZED" : "UNAVAILABLE", latestMaintenance],
        ["O", "Occupancy", occupancy, occupancyFinding, occupancy?.degraded ? "DEGRADED" : zones.length ? "ANALYZED" : "UNAVAILABLE", null],
        ["S", "Security", security, securityFinding, security?.threat_level ? security.threat_level.toUpperCase() : "UNAVAILABLE", latestSecurity]
    ];

    const visualValues = [energyAnalysis?.history?.length ? 100 : null, maintenance?.summary?.facility_health_score, averageOccupancy, null];
    $("agentStatusList").innerHTML = agents.map(([icon, name, data, finding, state, timestamp], index) => `
        <div class="agent-row"><div class="agent-icon">${icon}</div><div class="agent-info"><strong>${name} Agent</strong><span>${escape(finding)}${timestamp ? ` · ${escape(timestamp)}` : ""}</span><i class="agent-meter"><b style="width:${visualValues[index] ?? 0}%"></b></i></div><span class="agent-state ${statusClass(state)}">${state}</span></div>
    `).join("");
    $("signalFlow").innerHTML = [...agents.map(([, name, , finding]) => [name, finding]), ["Intelligence", recommendation?.text || "Awaiting agent output"]]
        .map(([name, finding], index, items) => `<div class="signal-node"><strong>${escape(name)}</strong><span>${escape(finding)}</span></div>${index < items.length - 1 ? '<span class="signal-arrow">→</span>' : ""}`).join("");

    const priorities = [];
    if (energyAnalysis?.anomalies?.length) priorities.push(["HIGH", "Energy anomaly pattern", "Energy", `${energyAnalysis.anomalies.length} detected day(s)`]);
    if (highRiskAssets) priorities.push(["HIGH", "Asset failure exposure", "Maintenance", `${highRiskAssets} high-risk asset(s)`]);
    if (zones.some(zone => zone.status === "overcrowded")) priorities.push(["HIGH", "Overcrowded zone detected", "Occupancy", "Review capacity pressure"]);
    if (securityThreats) priorities.push(["CRITICAL", "Active security threats", "Security", `${securityThreats} active threat(s)`]);
    $("priorityList").innerHTML = priorities.length ? priorities.map(([level, title, source, detail]) => `<div class="insight"><div class="priority-line"><strong>${escape(title)}</strong><span class="agent-state">${level}</span></div><span>${source} Agent · ${escape(detail)}</span></div>`).join("") : '<div class="insight">No prioritized findings returned by the agents.</div>';
    $("healthSummary").innerHTML = agents.map(([, name, , finding, state], index) => `<div class="health-cell"><span>${name}</span><strong>${escape(finding)}</strong><div class="summary-meter"><i style="width:${visualValues[index] ?? 0}%"></i></div><small>${state}</small></div>`).join("");
    $("findingCount").textContent = priorities.length;
    $("priorityCount").textContent = priorities.filter(item => item[0] === "HIGH" || item[0] === "CRITICAL").length;
    $("activeAgents").textContent = agents.filter(([, , data]) => data).length;
    $("healthScore").textContent = text(maintenance?.summary?.facility_health_score, averageOccupancy || "--");
    $("aiStatus").textContent = recommendation?.text ? "READY" : "WAITING";
    $("aiRecommendation").innerHTML = `<div class="ai-output-header"><span>${escape(recommendation?.source || "FACILITY AI")}</span><span class="result-status">${recommendation?.text ? "AVAILABLE" : "WAITING"}</span></div><div class="ai-output-body">${escape(recommendation?.text || "No agent recommendation returned for this facility.")}<div class="recommendation-meta">Source agents: Occupancy + Security</div></div>`;
    renderTimeline(snapshot);
}

function renderTimeline(data) {
    const events = [];
    const history = data.energy?.analysis?.history || [];
    const latestEnergy = history.map(item => item.date).filter(Boolean).sort().at(-1);
    if (latestEnergy) events.push([latestEnergy, "Energy telemetry", `${history.length} returned point(s)`]);
    (data.energy?.analysis?.anomalies || []).forEach(item => events.push([item.date, "Energy anomaly", `${item.excess_pct ?? "--"}% excess`]));
    (data.maintenance?.assets || []).forEach(item => { if (item.as_of) events.push([item.as_of, "Maintenance assessment", item.asset_id]); });
    (data.security?.events || []).forEach(item => events.push([item.event_time || item.timestamp, "Security event", item.severity || "RECORDED"]));
    const ordered = events.filter(item => item[0]).sort((a, b) => String(b[0]).localeCompare(String(a[0]))).slice(0, 8);
    $("decisionTimeline").innerHTML = ordered.length ? ordered.map(([date, title, detail]) => `<div class="timeline-item"><time>${escape(date)}</time><strong>${escape(title)}</strong><span>${escape(detail)}</span></div>`).join("") : '<div class="insight">Agent findings returned without usable timestamps.</div>';
}

async function refresh() {
    const facility = $("facility").value;
    const days = Number($("duration").value);
    if (!facility) return;
    $("orchestratorStatus").textContent = "ANALYZING";
    try {
        const [energy, maintenance, occupancyResult] = await Promise.all([
            getEnergyAnalysis(facility, days), getMaintenanceAssets(facility), getOccupancyAnalysis(facility, days)
        ]);
        render({ energy, maintenance, occupancy: occupancyResult.occupancy, security: occupancyResult.security, recommendation: occupancyResult.recommendation });
        $("orchestratorStatus").textContent = "ANALYSIS COMPLETE";
    } catch (error) {
        console.error(error);
        $("orchestratorStatus").textContent = "ERROR";
        $("agentStatusList").innerHTML = `<div class="insight">Unable to load facility intelligence: ${escape(error.message)}</div>`;
    }
}

$("facility").addEventListener("change", refresh);
$("duration").addEventListener("change", refresh);
$("runIntelligence")?.remove();
loadFacilitySelector().then(refresh).catch(error => console.error(error));
