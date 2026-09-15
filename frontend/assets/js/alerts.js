import { loadFacilitySelector } from "./facilities.js";

let alertChart = null;
let severityChart = null;

const $ = id => document.getElementById(id);


let alerts = [

    {
        id: 1,
        agent: "Energy",
        severity: "High",
        title: "Abnormal energy consumption",
        detail: "HVAC load is above the expected operating baseline.",
        time: "08:42",
        asset: "HVAC-03",
        status: "ACTIVE"
    },

    {
        id: 2,
        agent: "Maintenance",
        severity: "Critical",
        title: "Equipment degradation detected",
        detail: "Predicted asset health has crossed the intervention threshold.",
        time: "08:31",
        asset: "AHU-07",
        status: "ACTIVE"
    },

    {
        id: 3,
        agent: "Occupancy",
        severity: "Medium",
        title: "Unexpected occupancy increase",
        detail: "Observed utilization is above the predicted occupancy profile.",
        time: "08:17",
        asset: "Floor 6",
        status: "ACTIVE"
    },

    {
        id: 4,
        agent: "Security",
        severity: "High",
        title: "Access pattern anomaly",
        detail: "Multiple unusual access events were detected.",
        time: "07:56",
        asset: "North Entrance",
        status: "ACTIVE"
    },

    {
        id: 5,
        agent: "Cost",
        severity: "Medium",
        title: "Operating cost deviation",
        detail: "Current facility cost is trending above the expected range.",
        time: "07:40",
        asset: "Facility",
        status: "ACTIVE"
    },

    {
        id: 6,
        agent: "Energy",
        severity: "Low",
        title: "After-hours consumption",
        detail: "Low-level energy usage detected outside the expected schedule.",
        time: "06:58",
        asset: "Floor 2",
        status: "ACTIVE"
    }

];


function refresh() {
    const activeAlerts = alerts.filter(alert => alert.status === "ACTIVE");
    const counts = ["Critical", "High", "Medium", "Low"].reduce((result, severity) => {
        result[severity] = activeAlerts.filter(alert => alert.severity === severity).length;
        return result;
    }, {});
    $("activeAlerts").textContent = activeAlerts.length;
    $("criticalAlerts").textContent = counts.Critical;
    $("highAlerts").textContent = counts.High;
    $("resolvedAlerts").textContent = counts.Medium;
    $("responseTime").textContent = counts.Low;
    renderCharts(counts);
    renderPriority(activeAlerts);
    renderAgentBreakdown(activeAlerts);
    renderAlerts();
}


function renderCharts(counts) {

    const labels = [
        "00",
        "04",
        "08",
        "12",
        "16",
        "20"
    ];


    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const values = [counts.Low, counts.Medium, counts.High, total, counts.Critical, total];


    if (alertChart)
        alertChart.destroy();


    alertChart =
        new Chart(
            $("alertChart"),
            {

                type: "line",

                data: {

                    labels,

                    datasets: [

                        {
                            label: "Alerts",
                            data: values,
                            tension: 0.35,
                            fill: true
                        }

                    ]

                },

                options: {

                    responsive: true,
                    maintainAspectRatio: false

                }

            }

        );


    if (severityChart)
        severityChart.destroy();


    severityChart =
        new Chart(
            $("severityChart"),
            {

                type: "doughnut",

                data: {

                    labels: [
                        "Critical",
                        "High",
                        "Medium",
                        "Low"
                    ],

                    datasets: [

                        {
                            data: [counts.Critical, counts.High, counts.Medium, counts.Low]
                        }

                    ]

                },

                options: {

                    responsive: true,
                    maintainAspectRatio: false

                }

            }

        );

}

function renderPriority(activeAlerts) {
    const rank = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    const priority = [...activeAlerts].sort((a, b) =>
        (rank[b.severity] || 0) - (rank[a.severity] || 0)
    )[0];
    $("priorityTitle").textContent = priority ? priority.title : "No active priority alert";
    $("prioritySeverity").textContent = priority ? priority.severity.toUpperCase() : "CLEAR";
    $("priorityAlert").innerHTML = priority
        ? `<strong>${priority.agent} Agent</strong> · ${priority.asset}<br>${priority.detail}`
        : "No active alert is currently available.";
}

function renderAgentBreakdown(activeAlerts) {
    const counts = activeAlerts.reduce((result, alert) => {
        result[alert.agent] = (result[alert.agent] || 0) + 1;
        return result;
    }, {});
    $("agentBreakdown").innerHTML = Object.entries(counts).map(([agent, count]) => `
        <div class="health-distribution-item"><span>${agent}</span><strong>${count}</strong></div>
    `).join("") || `<div class="insight">No active agent alerts.</div>`;
}


function renderAlerts() {

    const agent =
        $("agentFilter").value;

    const severity =
        $("severityFilter").value;


    const filtered =
        alerts.filter(
            alert =>
                (
                    agent === "all" ||
                    alert.agent === agent
                ) &&
                (
                    severity === "all" ||
                    alert.severity === severity
                )
        );


    $("alertList").innerHTML =
        filtered.map(
            alert => `

            <div
                class="agent-row"
                onclick="showAlert(${alert.id})"
                style="cursor:pointer"
            >

                <div class="agent-icon">
                    ${alert.agent.charAt(0)}
                </div>

                <div class="agent-info">

                    <strong>
                        ${alert.title}
                    </strong>

                    <span>
                        ${alert.agent} Agent ·
                        ${alert.asset} ·
                        ${alert.time}${alert.status === "TEST" ? " · TEST / SIMULATION" : ""}
                    </span>

                </div>

                <div
                    style="
                        margin-left:auto;
                        text-align:right;
                    "
                >

                    <strong>
                        ${alert.severity.toUpperCase()}
                    </strong>

                    <br>

                    <span class="agent-state">
                        ${alert.status}
                    </span>

                </div>

            </div>

        `
        ).join("");


    if (!filtered.length) {

        $("alertList").innerHTML = `

            <div class="insight">
                No alerts match the selected filters.
            </div>

        `;

    }

}


function showAlert(id) {

    const alert =
        alerts.find(
            item => item.id === id
        );


    if (!alert)
        return;


    $("incidentStatus").textContent =
        alert.severity.toUpperCase();


    $("incidentDetail").innerHTML = `

        <div class="ai-output-header">

            <span>
                ${alert.agent.toUpperCase()} AGENT
            </span>

            <span class="result-status">
                ${alert.status}
            </span>

        </div>


        <div class="ai-output-body">

            <strong>
                ${alert.title}
            </strong>

            <br><br>

            ${alert.detail}

            <br><br>

            <strong>
                Source
            </strong>

            <br>

            ${alert.agent} Agent

            <br><br>

            <strong>
                Affected asset
            </strong>

            <br>

            ${alert.asset}

            <br><br>

            <strong>
                Agent recommendation
            </strong>

            <br>

            Investigate the underlying telemetry,
            correlate recent facility conditions and
            apply the appropriate corrective workflow.

        </div>

    `;

}


function generateTestAlert() {

    const agent =
        $("testAgent").value;

    const severity =
        $("testSeverity").value;

    const message =
        $("testMessage").value.trim();


    const newAlert = {

        id:
            Date.now(),

        agent,

        severity,

        title:
            message ||
            `${agent} Agent test condition`,

        detail:
            message ||
            "Simulated operational condition generated from the alert test lab.",

        time:
            "JUST NOW",

        asset:
            "Simulation",

        status:
            "TEST"

    };


    alerts.unshift(
        newAlert
    );


    renderAlerts();

    showAlert(
        newAlert.id
    );

    $("testMessage").value = "";

}


$("facility")
    .addEventListener(
        "change",
        refresh
    );


$("duration")
    .addEventListener(
        "change",
        refresh
    );


$("agentFilter")
    .addEventListener(
        "change",
        renderAlerts
    );


$("severityFilter")
    .addEventListener(
        "change",
        renderAlerts
    );


$("generateAlert")
    .addEventListener(
        "click",
        generateTestAlert
    );


loadFacilitySelector().then(refresh).catch(console.error);