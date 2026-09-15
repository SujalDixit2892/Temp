import { loadFacilitySelector } from "./facilities.js";
import { getOccupancyAnalysis } from "./api.js";

let incidentChart = null;
let riskChart = null;
let requestSequence = 0;
let productionSecurity = null;

const $ = id => document.getElementById(id);


/* =========================================================
   DASHBOARD
   ========================================================= */

async function refreshDashboard() {

    const facilityId = $("facility").value;
    const days = Number.parseInt($("duration").value, 10);
    const requestId = ++requestSequence;

    if (!facilityId) return;

    $("status").textContent = "ANALYZING";
    clearDashboard();

    try {
        const result = await getOccupancyAnalysis(facilityId, days);
        if (requestId !== requestSequence) return;
        const security = result?.security ?? {};
        productionSecurity = security;
        const activeThreats = Array.isArray(security.active_threats)
            ? security.active_threats
            : [];
        const anomalies = Array.isArray(security.anomalies)
            ? security.anomalies
            : [];
        const totalEvents = Number(security.total_events) || 0;
        const flaggedEvents = activeThreats.length + anomalies.length;

        $("overviewThreat").textContent = security.threat_level ?? "--";
        $("overviewEvents").textContent = totalEvents;
        $("overviewAnomalies").textContent = anomalies.length;
        $("overviewHighRisk").textContent = activeThreats.length;
        $("overviewZone").textContent = security.affected_zone ?? security.zone ?? "Not provided";

        $("securityScore").textContent = security.threat_level ?? "--";
        $("activeIncidents").textContent = activeThreats.length;
        $("highRisk").textContent = anomalies.length;
        $("anomalyRate").textContent = totalEvents
            ? `${((flaggedEvents / totalEvents) * 100).toFixed(1)}%`
            : "0%";
        $("status").textContent = security.threat_level
            ? `${security.threat_level.toUpperCase()} - ${totalEvents} EVENTS`
            : "COMPLETE";

        renderCharts(totalEvents, activeThreats.length, anomalies.length);
        renderHeatmap(activeThreats.length, anomalies.length);
        renderIncidentList(activeThreats, anomalies);
        renderTimeline(security);
    } catch (error) {
        if (requestId !== requestSequence) return;
        console.error(error);
        $("status").textContent = "ERROR";
        $("incidentList").innerHTML = `<div class="insight">Unable to load security data: ${error.message}</div>`;
    }
}

function clearDashboard() {
    $("securityScore").textContent = "--";
    $("activeIncidents").textContent = "--";
    $("highRisk").textContent = "--";
    $("anomalyRate").textContent = "--";
    $("overviewThreat").textContent = "--";
    $("overviewEvents").textContent = "--";
    $("overviewAnomalies").textContent = "--";
    $("overviewHighRisk").textContent = "--";
    $("overviewZone").textContent = "Not provided";
    $("securityTimelinePanel").hidden = true;
    $("incidentList").innerHTML = `<div class="insight">Loading security events...</div>`;
    $("securityHeatmap").replaceChildren();

    if (incidentChart) {
        incidentChart.destroy();
        incidentChart = null;
    }
    if (riskChart) {
        riskChart.destroy();
        riskChart = null;
    }
}


/* =========================================================
   CHARTS
   ========================================================= */

function renderCharts(totalEvents, activeThreatCount, anomalyCount) {

    if (!window.Chart) {
        throw new Error("Chart.js failed to load.");
    }

    const labels = ["Total events", "Active threats", "Anomalies"];
    const risk = [totalEvents, activeThreatCount, anomalyCount];


    if (incidentChart)
        incidentChart.destroy();


    incidentChart =
        new Chart(
            $("incidentChart"),
            {

                type: "line",

                data: {

                    labels,

                    datasets: [

                        {

                            label:
                                "Security Risk",

                            data:
                                risk,

                            tension:
                                0.35

                        }

                    ]

                },

                options: {

                    responsive:
                        true,

                    maintainAspectRatio:
                        false,

                    scales: {

                        y: {

                            min: 0

                        }

                    }

                }

            }
        );


    if (riskChart)
        riskChart.destroy();


    riskChart =
        new Chart(
            $("riskChart"),
            {

                type: "doughnut",

                data: {

                    labels: [
                        "Other events",
                        "Anomalies",
                        "Active threats"
                    ],

                    datasets: [

                        {

                            data: [
                                Math.max(0, totalEvents - anomalyCount - activeThreatCount),
                                anomalyCount,
                                activeThreatCount
                            ]

                        }

                    ]

                },

                options: {

                    responsive:
                        true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {

                            position:
                                "bottom"

                        }

                    }

                }

            }
        );

}


/* =========================================================
   HEATMAP
   ========================================================= */

function renderHeatmap(activeThreatCount, anomalyCount) {

    const container =
        $("securityHeatmap");


    const cells = [];


    for (let i = 0; i < 28; i++) {
        const isThreat = i < activeThreatCount;
        const isAnomaly = !isThreat && i < activeThreatCount + anomalyCount;
        const label = isThreat
            ? "Active threat"
            : isAnomaly
                ? "Anomaly"
                : "No flagged event";
        const color = isThreat
            ? "rgba(210, 70, 70, 0.9)"
            : isAnomaly
                ? "rgba(210, 140, 40, 0.75)"
                : "rgba(120, 135, 150, 0.12)";


        cells.push(`
            <div
                class="heat-cell"
                title="${label}"
                style="
                    background:
                    ${color};
                "
            ></div>
        `);

    }


    container.innerHTML =
        cells.join("");

}


/* =========================================================
   INCIDENT LIST
   ========================================================= */

function renderIncidentList(activeThreats, anomalies) {

    const container =
        $("incidentList");


    const incidents = [
        ...activeThreats.map(eventId => ({
            eventId,
            type: "Active threat",
            state: "THREAT"
        })),
        ...anomalies.map(eventId => ({
            eventId,
            type: "Anomaly",
            state: "ANOMALY"
        }))
    ];

    container.innerHTML = incidents.length
        ? incidents.slice(0, 6).map(incident => `

                <div class="agent-row">

                    <div class="agent-icon">
                        S
                    </div>

                    <div class="agent-info">

                        <strong>
                            ${incident.type}
                        </strong>

                        <span>
                            Event ${incident.eventId}
                        </span>

                    </div>

                    <span class="agent-state">

                        ${incident.state}

                    </span>

                </div>

            `).join("")
        : `<div class="insight">No active threats or anomalies.</div>`;

}

function renderTimeline(security) {
    const events = Array.isArray(security.events)
        ? security.events
        : Array.isArray(security.event_timeline)
            ? security.event_timeline
            : [];
    const timestamped = events.filter(event => event?.event_time || event?.timestamp);
    const panel = $("securityTimelinePanel");
    if (!timestamped.length) {
        panel.hidden = true;
        return;
    }
    $("securityTimeline").innerHTML = timestamped
        .sort((a, b) => String(a.event_time ?? a.timestamp).localeCompare(String(b.event_time ?? b.timestamp)))
        .map(event => `<div class="agent-row"><div class="agent-info"><strong>${event.event_type ?? "Security event"}</strong><span>${event.event_time ?? event.timestamp}</span></div><span class="agent-state">${event.severity ?? "RECORDED"}</span></div>`)
        .join("");
    panel.hidden = false;
}


/* =========================================================
   SECURITY SIMULATOR
   ========================================================= */

function analyzeSecurityEvent() {

    const type =
        $("eventType").value;

    const zone =
        $("zone").value;

    const severity =
        $("severity").value;

    const frequency =
        Number(
            $("frequency").value
        );

    const failedAttempts = Math.max(0, Number($("failedAttempts").value) || 0);


    const severityScore = {

        low: 20,

        medium: 45,

        high: 72,

        critical: 95

    }[severity];


    let risk =
        severityScore;


    risk +=
        Math.min(
            20,
            frequency * 2
        );

    risk += Math.min(20, failedAttempts * 3);


    if (
        zone ===
        "Server Room"
    ) {

        risk += 8;

    }


    if (
        zone ===
        "Restricted Area"
    ) {

        risk += 10;

    }


    risk =
        Math.min(
            100,
            risk
        );


    let priority;


    if (risk >= 85) {

        priority =
            "CRITICAL";

    } else if (risk >= 65) {

        priority =
            "HIGH";

    } else if (risk >= 40) {

        priority =
            "MEDIUM";

    } else {

        priority =
            "LOW";

    }


    $("testStatus").textContent =
        "ANALYSIS COMPLETE";


    const zoneFactor = zone === "Restricted Area" ? 10 : zone === "Server Room" ? 8 : 0;
    const factors = [
        ["Scenario severity", severityScore, severityScore],
        ["Failed attempts", failedAttempts * 3, 20],
        ["Event frequency", Math.min(20, frequency * 2), 20],
        ["Zone sensitivity", zoneFactor, 10]
    ];
    const liveLevel = productionSecurity?.threat_level ?? "Unavailable";
    const liveEvents = Number(productionSecurity?.total_events);
    const responseSteps = priority === "CRITICAL"
        ? ["Escalate to security lead", `Restrict ${zone} access`, "Preserve access and camera records"]
        : priority === "HIGH"
            ? ["Dispatch security personnel", `Verify activity in ${zone}`, "Increase zone monitoring"]
            : ["Validate access logs", `Review activity in ${zone}`, "Continue enhanced monitoring"];

    $("testResult").innerHTML = `
        <div class="simulation-result-head">
            <div><span class="simulation-kicker">SIMULATION / WHAT-IF RESULT</span><strong>${type.replaceAll("_", " ").toUpperCase()}</strong></div>
            <div class="simulation-score"><strong>${risk}</strong><span>/ 100</span></div>
        </div>
        <div class="simulation-summary"><span class="simulation-risk risk-${priority.toLowerCase()}">SIMULATED ${priority}</span><span>${zone}</span><span>${frequency} events</span><span>${failedAttempts} failed attempts</span></div>
        <div class="simulation-grid">
            <div><span class="simulation-kicker">CONTRIBUTING FACTORS</span>${factors.map(([label, value, max]) => `<div class="factor-row"><span>${label}</span><b>${value}</b><i><em style="width:${Math.min(100, value / max * 100)}%"></em></i></div>`).join("")}</div>
            <div class="simulation-compare"><span class="simulation-kicker">LIVE VS SIMULATED</span><div><span>LIVE FACILITY</span><b>${liveLevel} · ${Number.isFinite(liveEvents) ? liveEvents : "--"} events</b></div><div class="compare-simulated"><span>WHAT-IF ONLY</span><b>${priority} · ${risk}/100</b></div></div>
        </div>
    `;


    let response;


    if (risk >= 85) {

        response =
            "Immediately escalate the event, restrict access to the affected zone, notify security personnel and preserve relevant surveillance/access records.";

    } else if (risk >= 65) {

        response =
            "Dispatch security personnel for verification, review access logs and increase monitoring of the affected zone.";

    } else if (risk >= 40) {

        response =
            "Continue enhanced monitoring and validate whether the event represents a recurring behavioural anomaly.";

    } else {

        response =
            "Record the event and continue normal monitoring unless additional correlated anomalies occur.";

    }


    $("recommendation").innerHTML = `

        <div class="simulation-response"><div><span class="simulation-kicker">SIMULATED RESPONSE PLAN</span><strong>${priority} PRIORITY</strong></div>${responseSteps.map((step, index) => `<div class="response-step"><b>${index + 1}</b><span>${step}</span></div>`).join("")}<small>${response} This is a what-if recommendation only.</small></div>

    `;

}

function resetSecurityTest() {
    $("eventType").value = "unauthorized_access";
    $("zone").value = "Server Room";
    $("severity").value = "medium";
    $("frequency").value = "3";
    $("failedAttempts").value = "0";
    $("testStatus").textContent = "WAITING - SIMULATION ONLY";
    $("testResult").textContent = "Configure a scenario and run it. No production data will be changed.";
    $("recommendation").innerHTML = "<div class=\"insight\">Simulated recommendations will appear after a scenario is run.</div>";
}


/* =========================================================
   EVENTS
   ========================================================= */

$("facility")
    .addEventListener(
        "change",
        refreshDashboard
    );


$("duration")
    .addEventListener(
        "change",
        refreshDashboard
    );


$("runSecurityTest")
    .addEventListener(
        "click",
        analyzeSecurityEvent
    );

$("resetSecurityTest")
    .addEventListener(
        "click",
        resetSecurityTest
    );


/* =========================================================
   START
   ========================================================= */

async function initializeDashboard() {
    const facilitySelector = $("facility");
    const durationSelector = $("duration");

    try {
        await loadFacilitySelector();
        facilitySelector.disabled = false;
        durationSelector.disabled = false;
        await refreshDashboard();
    } catch (error) {
        console.error(error);
        facilitySelector.disabled = false;
        durationSelector.disabled = false;
        $("status").textContent = "BACKEND ERROR";
        $("incidentList").innerHTML = `<div class="insight">Unable to load facilities: ${error.message}</div>`;
    }
}

initializeDashboard();