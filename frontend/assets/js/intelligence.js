import { loadFacilitySelector } from "./facilities.js";

let intelligenceChart = null;

const $ = id => document.getElementById(id);


/* =========================================================
   FACILITY PROFILES
   ========================================================= */

const facilities = {

    "HQ Tower": {
        health: 91,
        energy: 88,
        maintenance: 94,
        occupancy: 82,
        security: 91,
        cost: 86
    },

    "Operations Center": {
        health: 86,
        energy: 79,
        maintenance: 87,
        occupancy: 91,
        security: 86,
        cost: 82
    },

    "Manufacturing Plant": {
        health: 78,
        energy: 71,
        maintenance: 73,
        occupancy: 84,
        security: 79,
        cost: 69
    },

    "Warehouse": {
        health: 84,
        energy: 81,
        maintenance: 88,
        occupancy: 76,
        security: 84,
        cost: 79
    }

};


/* =========================================================
   AGENT PROFILES
   ========================================================= */

const agentNames = {

    energy: "Energy Agent",

    maintenance: "Maintenance Agent",

    occupancy: "Occupancy Agent",

    security: "Security Agent",

    cost: "Cost Agent"

};


/* =========================================================
   REFRESH
   ========================================================= */

function refreshIntelligence() {

    const facility =
        facilities[
            $("facility").value
        ] || Object.values(facilities)[0];


    if (!facility)
        return;


    $("healthScore").textContent =
        facility.health;


    const findings =
        Math.round(
            (
                100 -
                facility.energy +
                100 -
                facility.maintenance +
                100 -
                facility.occupancy +
                100 -
                facility.security
            ) / 10
        ) + 6;


    $("findingCount").textContent =
        findings;


    $("priorityCount").textContent =
        Math.max(
            2,
            Math.round(
                (100 - facility.health) / 8
            )
        );


    renderAgentStatus(
        facility
    );


    renderPriorities(
        facility
    );


    renderChart(
        facility
    );

}


/* =========================================================
   AGENT STATUS
   ========================================================= */

function renderAgentStatus(
    facility
) {

    const agents = [

        {
            key: "energy",
            score: facility.energy
        },

        {
            key: "maintenance",
            score: facility.maintenance
        },

        {
            key: "occupancy",
            score: facility.occupancy
        },

        {
            key: "security",
            score: facility.security
        },

        {
            key: "cost",
            score: facility.cost
        }

    ];


    $("agentStatusList").innerHTML =
        agents.map(agent => {

            const state =
                agent.score >= 85
                    ? "HEALTHY"
                    : agent.score >= 70
                        ? "MONITOR"
                        : "ATTENTION";


            return `

                <div class="agent-row">

                    <div class="agent-icon">
                        ${agent.key.charAt(0).toUpperCase()}
                    </div>


                    <div class="agent-info">

                        <strong>
                            ${agentNames[agent.key]}
                        </strong>

                        <span>
                            Intelligence score
                        </span>

                    </div>


                    <div
                        style="
                            text-align:right;
                            margin-left:auto;
                        "
                    >

                        <strong>
                            ${agent.score}
                        </strong>

                        <br>

                        <span class="agent-state">
                            ${state}
                        </span>

                    </div>

                </div>

            `;

        }).join("");

}


/* =========================================================
   PRIORITIES
   ========================================================= */

function renderPriorities(
    facility
) {

    const priorities = [];


    if (facility.energy < 85) {

        priorities.push({

            title:
                "Review energy consumption",

            source:
                "Energy Agent",

            impact:
                "Potential operational savings",

            priority:
                "HIGH"

        });

    }


    if (facility.maintenance < 85) {

        priorities.push({

            title:
                "Inspect high-risk assets",

            source:
                "Maintenance Agent",

            impact:
                "Reduce unplanned downtime",

            priority:
                "HIGH"

        });

    }


    if (facility.occupancy > 88) {

        priorities.push({

            title:
                "Review occupancy distribution",

            source:
                "Occupancy Agent",

            impact:
                "Reduce capacity pressure",

            priority:
                "MEDIUM"

        });

    }


    if (facility.security < 85) {

        priorities.push({

            title:
                "Increase security monitoring",

            source:
                "Security Agent",

            impact:
                "Reduce incident exposure",

            priority:
                "HIGH"

        });

    }


    if (facility.cost < 85) {

        priorities.push({

            title:
                "Optimize operating expenditure",

            source:
                "Cost Agent",

            impact:
                "Improve facility efficiency",

            priority:
                "MEDIUM"

        });

    }


    if (!priorities.length) {

        priorities.push({

            title:
                "Continue normal monitoring",

            source:
                "Facility Intelligence",

            impact:
                "No major operational risk detected",

            priority:
                "LOW"

        });

    }


    $("priorityList").innerHTML =
        priorities.slice(0, 5).map(
            item => `

            <div class="insight">

                <div
                    style="
                        display:flex;
                        justify-content:space-between;
                        gap:15px;
                    "
                >

                    <strong>
                        ${item.title}
                    </strong>

                    <span class="agent-state">
                        ${item.priority}
                    </span>

                </div>


                <span>
                    ${item.source}
                    ·
                    ${item.impact}
                </span>

            </div>

        `
        ).join("");

}


/* =========================================================
   INTELLIGENCE CHART
   ========================================================= */

function renderChart(
    facility
) {

    if (intelligenceChart)
        intelligenceChart.destroy();


    intelligenceChart =
        new Chart(
            $("intelligenceChart"),
            {

                type: "radar",

                data: {

                    labels: [

                        "Energy",
                        "Maintenance",
                        "Occupancy",
                        "Security",
                        "Cost"

                    ],

                    datasets: [

                        {

                            label:
                                "Facility Intelligence",

                            data: [

                                facility.energy,
                                facility.maintenance,
                                facility.occupancy,
                                facility.security,
                                facility.cost

                            ]

                        }

                    ]

                },

                options: {

                    responsive:
                        true,

                    maintainAspectRatio:
                        false,

                    scales: {

                        r: {

                            min: 0,

                            max: 100

                        }

                    }

                }

            }
        );

}


/* =========================================================
   LOCAL AI REASONING
   ========================================================= */

function runLocalAnalysis() {

    const signal =
        $("primarySignal").value;

    const severity =
        $("signalSeverity").value;

    const duration =
        Number(
            $("impactDuration").value
        );

    const context =
        $("additionalContext").value.trim();


    const severityScore = {

        low: 25,

        medium: 50,

        high: 75,

        critical: 95

    }[severity];


    const durationImpact =
        Math.min(
            20,
            duration
        );


    const risk =
        Math.min(
            100,
            severityScore +
            durationImpact
        );


    const signalName =
        {

            energy:
                "Energy consumption anomaly",

            maintenance:
                "Asset failure risk",

            occupancy:
                "Occupancy spike",

            security:
                "Security incident",

            cost:
                "Operating cost increase"

        }[signal];


    let priority;

    if (risk >= 85)
        priority = "CRITICAL";
    else if (risk >= 65)
        priority = "HIGH";
    else if (risk >= 40)
        priority = "MEDIUM";
    else
        priority = "LOW";


    let recommendation;


    switch (signal) {

        case "energy":

            recommendation =
                "Correlate the energy deviation with occupancy and HVAC operating schedules. Inspect abnormal loads before applying broad operational changes.";

            break;


        case "maintenance":

            recommendation =
                "Prioritize the affected asset for inspection and compare its sensor behaviour against historical operating patterns.";

            break;


        case "occupancy":

            recommendation =
                "Compare the occupancy increase against capacity, HVAC demand and security activity. Adjust operating conditions if the increase persists.";

            break;


        case "security":

            recommendation =
                "Increase monitoring of the affected area, correlate access activity with occupancy signals and escalate if additional anomalies are detected.";

            break;


        case "cost":

            recommendation =
                "Break down the cost increase into energy, maintenance and operating components before selecting an optimization action.";

            break;

    }


    if (context) {

        recommendation +=
            ` Additional context provided: "${context}".`;

    }


    $("analysisStatus").textContent =
        "ANALYSIS COMPLETE";


    $("analysisResult").innerHTML = `

        <strong>
            ${signalName}
        </strong>

        <br><br>

        Severity:
        ${severity.toUpperCase()}

        <br>

        Duration:
        ${duration} hour(s)

        <br>

        Cross-agent risk:
        <strong>${risk}/100</strong>

        <br>

        Priority:
        <strong>${priority}</strong>

    `;


    $("orchestratorStatus").textContent =
        "ANALYSIS COMPLETE";


    $("aiStatus").textContent =
        "ACTIVE";


    $("aiRecommendation").innerHTML = `

        <div class="ai-output-header">

            <span>
                FACILITY AI
            </span>

            <span class="result-status">
                ${priority}
            </span>

        </div>


        <div class="ai-output-body">

            <strong>
                Recommended operational response
            </strong>

            <br><br>

            ${recommendation}

            <br><br>

            <strong>
                Reasoning chain
            </strong>

            <br><br>

            Signal detected →
            severity evaluated →
            duration impact assessed →
            cross-agent context considered →
            action prioritized.

        </div>

    `;


    addReasoning(
        signalName,
        priority,
        recommendation
    );

}


/* =========================================================
   REASONING FEED
   ========================================================= */

function addReasoning(
    signal,
    priority,
    recommendation
) {

    const feed =
        $("reasoningFeed");


    const item =
        document.createElement(
            "div"
        );


    item.className =
        "reasoning-item";


    item.innerHTML = `

        <span class="reasoning-index">
            NEW
        </span>

        <div>

            <strong>
                ${priority} signal:
                ${signal}
            </strong>

            <p>
                ${recommendation}
            </p>

        </div>

    `;


    feed.prepend(item);

}


/* =========================================================
   EVENTS
   ========================================================= */

$("facility")
    .addEventListener(
        "change",
        refreshIntelligence
    );


$("duration")
    .addEventListener(
        "change",
        refreshIntelligence
    );


$("runIntelligence")
    .addEventListener(
        "click",
        runLocalAnalysis
    );


/* =========================================================
   INITIALIZE
   ========================================================= */

loadFacilitySelector().then(refreshIntelligence).catch(console.error);