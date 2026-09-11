import { loadFacilitySelector } from "./facilities.js";

let activityChart = null;
let reliabilityChart = null;

const $ = id => document.getElementById(id);


/* =========================================================
   FACILITY PROFILES
   ========================================================= */

const facilities = {

    "HQ Tower": {
        executions: 1284,
        success: 98.7,
        latency: 1.8,
        handoffs: 347
    },

    "Operations Center": {
        executions: 1542,
        success: 97.9,
        latency: 2.1,
        handoffs: 421
    },

    "Manufacturing Plant": {
        executions: 2187,
        success: 96.8,
        latency: 2.7,
        handoffs: 638
    },

    "Warehouse": {
        executions: 967,
        success: 99.1,
        latency: 1.5,
        handoffs: 214
    }

};


/* =========================================================
   AGENTS
   ========================================================= */

const agents = [

    {
        name: "Energy Agent",
        key: "energy",
        executions: 318,
        latency: 1.4,
        reliability: 99.1,
        state: "ACTIVE"
    },

    {
        name: "Maintenance Agent",
        key: "maintenance",
        executions: 274,
        latency: 2.2,
        reliability: 97.8,
        state: "ACTIVE"
    },

    {
        name: "Occupancy Agent",
        key: "occupancy",
        executions: 246,
        latency: 1.3,
        reliability: 99.4,
        state: "ACTIVE"
    },

    {
        name: "Security Agent",
        key: "security",
        executions: 281,
        latency: 1.7,
        reliability: 98.5,
        state: "ACTIVE"
    },

    {
        name: "Cost Agent",
        key: "cost",
        executions: 165,
        latency: 2.4,
        reliability: 97.1,
        state: "ACTIVE"
    }

];


/* =========================================================
   REFRESH
   ========================================================= */

function refreshActivity() {

    const facility =
        facilities[
            $("facility").value
        ] || Object.values(facilities)[0];


    const days =
        Number(
            $("duration").value
        );


    $("executionCount").textContent =
        Math.round(
            facility.executions *
            (days / 7)
        ).toLocaleString();


    $("successRate").textContent =
        `${facility.success}%`;


    $("latency").textContent =
        `${facility.latency}s`;


    $("handoffs").textContent =
        Math.round(
            facility.handoffs *
            (days / 7)
        ).toLocaleString();


    renderCharts(
        facility,
        days
    );


    renderFleet(
        facility
    );


    renderEvents();

    renderHandoffs();

}


/* =========================================================
   CHARTS
   ========================================================= */

function renderCharts(
    facility,
    days
) {

    const points =
        days === 1
            ? 12
            : days === 7
                ? 14
                : days === 30
                    ? 15
                    : 16;


    const labels = [];

    const executions = [];


    for (
        let i = 0;
        i < points;
        i++
    ) {

        labels.push(
            days === 1
                ? `${String(i * 2).padStart(2, "0")}:00`
                : `D-${points - i}`
        );


        const base =
            facility.executions /
            points;


        executions.push(
            Math.max(
                20,
                Math.round(
                    base *
                    (
                        0.65 +
                        Math.random() * 0.7
                    )
                )
            )
        );

    }


    if (activityChart)
        activityChart.destroy();


    activityChart =
        new Chart(
            $("activityChart"),
            {

                type: "line",

                data: {

                    labels,

                    datasets: [

                        {

                            label:
                                "Agent Executions",

                            data:
                                executions,

                            tension:
                                0.35,

                            fill:
                                true

                        }

                    ]

                },

                options: {

                    responsive:
                        true,

                    maintainAspectRatio:
                        false,

                    interaction: {

                        intersect:
                            false,

                        mode:
                            "index"

                    }

                }

            }
        );


    if (reliabilityChart)
        reliabilityChart.destroy();


    reliabilityChart =
        new Chart(
            $("reliabilityChart"),
            {

                type: "bar",

                data: {

                    labels:
                        agents.map(
                            a => a.name.replace(
                                " Agent",
                                ""
                            )
                        ),

                    datasets: [

                        {

                            label:
                                "Reliability %",

                            data:
                                agents.map(
                                    a =>
                                        Math.min(
                                            100,
                                            a.reliability -
                                            (
                                                100 -
                                                facility.success
                                            ) *
                                            0.2
                                        )
                                )

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

                            min: 90,

                            max: 100

                        }

                    }

                }

            }
        );

}


/* =========================================================
   AGENT FLEET
   ========================================================= */

function renderFleet(
    facility
) {

    $("agentFleet").innerHTML =
        agents.map(
            agent => `

            <div class="agent-row">

                <div class="agent-icon">

                    ${agent.key
                        .charAt(0)
                        .toUpperCase()}

                </div>


                <div class="agent-info">

                    <strong>
                        ${agent.name}
                    </strong>

                    <span>
                        ${agent.executions}
                        executions ·
                        ${agent.latency}s avg latency
                    </span>

                </div>


                <div
                    style="
                        margin-left:auto;
                        text-align:right;
                    "
                >

                    <strong>
                        ${agent.reliability}%
                    </strong>

                    <br>

                    <span class="agent-state">
                        ${agent.state}
                    </span>

                </div>

            </div>

        `
        ).join("");

}


/* =========================================================
   EVENT STREAM
   ========================================================= */

const eventTemplates = [

    [
        "Energy Agent",
        "Consumption anomaly detected",
        "2.4 kW deviation"
    ],

    [
        "Maintenance Agent",
        "Asset health evaluated",
        "AHU-03 risk updated"
    ],

    [
        "Occupancy Agent",
        "Occupancy forecast generated",
        "Peak expected at 14:00"
    ],

    [
        "Security Agent",
        "Access pattern analyzed",
        "No escalation required"
    ],

    [
        "Cost Agent",
        "Optimization opportunity identified",
        "Estimated savings available"
    ],

    [
        "Orchestrator",
        "Agent context synchronized",
        "5 agents updated"
    ]

];


function renderEvents() {

    $("eventStream").innerHTML =
        eventTemplates
            .slice(0, 6)
            .map(
                (event, index) => `

                <div class="agent-row">

                    <div class="agent-icon">
                        ${index + 1}
                    </div>

                    <div class="agent-info">

                        <strong>
                            ${event[0]}
                        </strong>

                        <span>
                            ${event[1]}
                        </span>

                    </div>

                    <div
                        style="
                            margin-left:auto;
                            text-align:right;
                        "
                    >

                        <strong>
                            ${event[2]}
                        </strong>

                        <br>

                        <span class="agent-state">
                            ${index < 4
                                ? "COMPLETED"
                                : "SYNCED"}
                        </span>

                    </div>

                </div>

            `
            )
            .join("");

}


/* =========================================================
   HANDOFFS
   ========================================================= */

const handoffs = [

    ["Energy", "Occupancy", "Load correlation"],

    ["Occupancy", "Energy", "Demand context"],

    ["Maintenance", "Energy", "Asset efficiency"],

    ["Security", "Occupancy", "Access correlation"],

    ["Energy", "Cost", "Financial impact"],

    ["Maintenance", "Cost", "Repair economics"]

];


function renderHandoffs() {

    $("handoffList").innerHTML =
        handoffs.map(
            handoff => `

            <div class="agent-row">

                <div class="agent-icon">
                    →
                </div>

                <div class="agent-info">

                    <strong>
                        ${handoff[0]}
                        →
                        ${handoff[1]}
                    </strong>

                    <span>
                        ${handoff[2]}
                    </span>

                </div>

                <span class="agent-state">
                    SYNCED
                </span>

            </div>

        `
        ).join("");

}


/* =========================================================
   AGENT WORKFLOW SIMULATOR
   ========================================================= */

function runAgentWorkflow() {

    const trigger =
        $("triggerType").value;

    const severity =
        $("triggerSeverity").value;

    const impact =
        $("triggerImpact").value;

    const context =
        $("triggerContext").value.trim();


    const names = {

        energy:
            "Energy Agent",

        maintenance:
            "Maintenance Agent",

        occupancy:
            "Occupancy Agent",

        security:
            "Security Agent",

        cost:
            "Cost Agent"

    };


    const selectedAgent =
        names[trigger];


    const severityScore = {

        low: 25,

        medium: 50,

        high: 75,

        critical: 95

    }[severity];


    const priority =
        severityScore >= 85
            ? "CRITICAL"
            : severityScore >= 65
                ? "HIGH"
                : severityScore >= 40
                    ? "MEDIUM"
                    : "LOW";


    $("runStatus").textContent =
        "WORKFLOW COMPLETE";


    $("runResult").innerHTML = `

        <strong>
            ${selectedAgent}
        </strong>

        selected as primary agent.

        <br><br>

        Trigger:
        ${trigger.replaceAll("_", " ")}

        <br>

        Severity:
        ${severity.toUpperCase()}

        <br>

        Business impact:
        ${impact}

        <br>

        Priority:
        <strong>${priority}</strong>

        ${
            context
                ? `<br><br>Observation: ${context}`
                : ""
        }

    `;


    let secondaryAgent;


    if (trigger === "energy")
        secondaryAgent = "Occupancy Agent";

    else if (trigger === "maintenance")
        secondaryAgent = "Energy Agent";

    else if (trigger === "occupancy")
        secondaryAgent = "Energy Agent";

    else if (trigger === "security")
        secondaryAgent = "Occupancy Agent";

    else
        secondaryAgent = "Energy Agent";


    $("traceStatus").textContent =
        "COMPLETED";


    $("decisionOutput").innerHTML = `

        <div class="ai-output-header">

            <span>
                ORCHESTRATOR
            </span>

            <span class="result-status">
                ${priority}
            </span>

        </div>


        <div class="ai-output-body">

            <strong>
                Workflow executed successfully.
            </strong>

            <br><br>

            Primary agent:
            ${selectedAgent}

            <br>

            Secondary context:
            ${secondaryAgent}

            <br>

            Impact category:
            ${impact}

            <br><br>

            <strong>
                Agent reasoning
            </strong>

            <br><br>

            The orchestrator selected the
            ${selectedAgent} based on the incoming
            operational signal, then requested
            supporting context from the
            ${secondaryAgent} before producing
            a prioritized response.

            <br><br>

            Recommended next step:
            investigate the underlying signal,
            correlate supporting telemetry and
            escalate according to the calculated
            ${priority.toLowerCase()} priority.

        </div>

    `;


    addExecutionEvent(
        selectedAgent,
        secondaryAgent,
        priority
    );

}


/* =========================================================
   ADD SIMULATED EVENT
   ========================================================= */

function addExecutionEvent(
    primary,
    secondary,
    priority
) {

    const stream =
        $("eventStream");


    const item =
        document.createElement(
            "div"
        );


    item.className =
        "agent-row";


    item.innerHTML = `

        <div class="agent-icon">
            N
        </div>

        <div class="agent-info">

            <strong>
                ${primary}
            </strong>

            <span>
                New workflow executed →
                ${secondary}
            </span>

        </div>

        <div
            style="
                margin-left:auto;
                text-align:right;
            "
        >

            <strong>
                ${priority}
            </strong>

            <br>

            <span class="agent-state">
                JUST NOW
            </span>

        </div>

    `;


    stream.prepend(item);

}


/* =========================================================
   EVENTS
   ========================================================= */

$("facility")
    .addEventListener(
        "change",
        refreshActivity
    );


$("duration")
    .addEventListener(
        "change",
        refreshActivity
    );


$("runAgent")
    .addEventListener(
        "click",
        runAgentWorkflow
    );


/* =========================================================
   INIT
   ========================================================= */

loadFacilitySelector().then(refreshActivity).catch(console.error);