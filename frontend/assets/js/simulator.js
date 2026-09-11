import { loadFacilitySelector } from "./facilities.js";

let riskChart = null;

const $ = id => document.getElementById(id);


const facilityProfiles = {

    "HQ Tower": {
        energyBase: 640,
        occupancy: 72,
        equipment: 91
    },

    "Operations Center": {
        energyBase: 720,
        occupancy: 81,
        equipment: 87
    },

    "Manufacturing Plant": {
        energyBase: 980,
        occupancy: 76,
        equipment: 74
    },

    "Warehouse": {
        energyBase: 510,
        occupancy: 61,
        equipment: 89
    }

};


/* =========================================================
   READ INPUT
   ========================================================= */

function getInput() {

    return {

        occupancy:
            Number($("occupancy").value),

        energy:
            Number($("energy").value),

        temperature:
            Number($("temperature").value),

        equipment:
            Number($("equipment").value),

        security:
            Number($("security").value),

        cost:
            Number($("cost").value)

    };

}


/* =========================================================
   RANDOM DATA
   ========================================================= */

function randomize() {

    const facility =
        facilityProfiles[
            $("facility").value
        ] || Object.values(facilityProfiles)[0];


    $("occupancy").value =
        Math.floor(
            35 + Math.random() * 60
        );


    $("energy").value =
        Math.floor(
            facility.energyBase *
            (
                0.75 +
                Math.random() * 0.8
            )
        );


    $("temperature").value =
        Math.floor(
            20 + Math.random() * 20
        );


    $("equipment").value =
        Math.floor(
            55 + Math.random() * 44
        );


    $("security").value =
        Math.floor(
            Math.random() * 9
        );


    $("cost").value =
        Math.floor(
            15 + Math.random() * 75
        );

}


/* =========================================================
   UPDATE SNAPSHOT
   ========================================================= */

function updateSnapshot(data) {

    $("outOccupancy").textContent =
        `${data.occupancy}%`;

    $("outEnergy").textContent =
        data.energy;

    $("outTemperature").textContent =
        `${data.temperature}°C`;

    $("outEquipment").textContent =
        `${data.equipment}%`;

    $("outSecurity").textContent =
        data.security;

}


/* =========================================================
   ANOMALY DETECTION
   ========================================================= */

function detectAnomalies(data) {

    const anomalies = [];


    if (data.energy > 800) {

        anomalies.push({
            title:
                "High energy load",

            detail:
                "Energy consumption is above the simulated operational baseline.",

            severity:
                "HIGH"
        });

    }


    if (
        data.occupancy > 85 &&
        data.energy > 700
    ) {

        anomalies.push({
            title:
                "Occupancy-driven demand",

            detail:
                "High occupancy is coinciding with elevated facility load.",

            severity:
                "MEDIUM"
        });

    }


    if (data.equipment < 70) {

        anomalies.push({
            title:
                "Equipment degradation",

            detail:
                "Asset health has crossed the simulated maintenance threshold.",

            severity:
                "HIGH"
        });

    }


    if (data.security >= 6) {

        anomalies.push({
            title:
                "Security activity spike",

            detail:
                "Security events exceed the normal simulated range.",

            severity:
                "HIGH"
        });

    }


    if (data.cost > 70) {

        anomalies.push({
            title:
                "Cost pressure",

            detail:
                "Operating cost pressure indicates an optimization opportunity.",

            severity:
                "MEDIUM"
        });

    }


    if (
        data.temperature > 35 &&
        data.energy > 700
    ) {

        anomalies.push({
            title:
                "Environmental energy correlation",

            detail:
                "High outdoor temperature is coinciding with elevated energy demand.",

            severity:
                "MEDIUM"
        });

    }


    return anomalies;

}


/* =========================================================
   RISK SCORE
   ========================================================= */

function calculateRisk(data) {

    let risk = 20;


    if (data.energy > 800)
        risk += 18;


    if (data.energy > 1000)
        risk += 10;


    if (data.equipment < 70)
        risk += 20;


    if (data.security >= 6)
        risk += 18;


    if (data.cost > 70)
        risk += 10;


    if (data.occupancy > 90)
        risk += 8;


    if (data.temperature > 35)
        risk += 6;


    return Math.min(
        100,
        risk
    );

}


/* =========================================================
   ROUTE TO AGENTS
   ========================================================= */

function routeAgents(data, anomalies) {

    const routes = [];


    if (
        data.energy > 800 ||
        data.temperature > 35
    ) {

        routes.push({
            agent:
                "Energy Agent",

            reason:
                "Analyze abnormal energy demand"
        });

    }


    if (data.equipment < 75) {

        routes.push({
            agent:
                "Maintenance Agent",

            reason:
                "Assess equipment degradation"
        });

    }


    if (data.occupancy > 85) {

        routes.push({
            agent:
                "Occupancy Agent",

            reason:
                "Evaluate utilization and demand"
        });

    }


    if (data.security >= 5) {

        routes.push({
            agent:
                "Security Agent",

            reason:
                "Analyze security event pattern"
        });

    }


    if (data.cost > 65) {

        routes.push({
            agent:
                "Cost Agent",

            reason:
                "Evaluate optimization opportunities"
        });

    }


    if (!routes.length) {

        routes.push({
            agent:
                "Facility Intelligence",

            reason:
                "Continue normal monitoring"
        });

    }


    return routes;

}


/* =========================================================
   RENDER ANOMALIES
   ========================================================= */

function renderAnomalies(anomalies) {

    if (!anomalies.length) {

        $("anomalies").innerHTML = `

            <div class="insight">

                <strong>
                    No significant anomaly detected
                </strong>

                <br><br>

                The simulated facility state remains
                within the configured operational range.

            </div>

        `;

        return;

    }


    $("anomalies").innerHTML =
        anomalies.map(
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
                        ${item.severity}
                    </span>

                </div>

                <span>
                    ${item.detail}
                </span>

            </div>

        `
        ).join("");

}


/* =========================================================
   RENDER AGENTS
   ========================================================= */

function renderAgents(routes) {

    $("agentRouting").innerHTML =
        routes.map(
            route => `

            <div class="agent-row">

                <div class="agent-icon">
                    ${route.agent
                        .charAt(0)}
                </div>

                <div class="agent-info">

                    <strong>
                        ${route.agent}
                    </strong>

                    <span>
                        ${route.reason}
                    </span>

                </div>

                <span class="agent-state">
                    ROUTED
                </span>

            </div>

        `
        ).join("");

}


/* =========================================================
   CHART
   ========================================================= */

function renderRiskChart(
    data,
    risk
) {

    if (riskChart)
        riskChart.destroy();


    riskChart =
        new Chart(
            $("riskChart"),
            {

                type: "doughnut",

                data: {

                    labels: [
                        "Risk",
                        "Remaining"
                    ],

                    datasets: [

                        {
                            data: [
                                risk,
                                100 - risk
                            ]
                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,

                    cutout:
                        "72%",

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
   RECOMMENDATION
   ========================================================= */

function buildRecommendation(
    data,
    anomalies,
    routes,
    risk
) {

    let action;


    if (risk >= 75) {

        action =
            "Escalate the facility condition for immediate operational review and prioritize the highest-risk agent findings.";

    }
    else if (risk >= 50) {

        action =
            "Investigate the detected signals, correlate supporting telemetry and schedule corrective action before the condition worsens.";

    }
    else {

        action =
            "Continue normal monitoring while tracking the detected signals for persistence.";

    }


    const primary =
        routes[0].agent;


    $("recommendation").innerHTML = `

        <div class="ai-output-header">

            <span>
                FACILITY INTELLIGENCE
            </span>

            <span class="result-status">
                RISK ${risk}/100
            </span>

        </div>


        <div class="ai-output-body">

            <strong>
                Primary agent:
            </strong>

            ${primary}

            <br><br>

            <strong>
                Detected signals:
            </strong>

            ${anomalies.length}

            <br><br>

            <strong>
                Operational recommendation:
            </strong>

            ${action}

            <br><br>

            <strong>
                Decision path:
            </strong>

            Facility inputs →
            anomaly detection →
            agent routing →
            cross-agent assessment →
            prioritized recommendation.

        </div>

    `;

}


/* =========================================================
   RUN
   ========================================================= */

function runSimulation() {

    const data =
        getInput();


    const anomalies =
        detectAnomalies(data);


    const risk =
        calculateRisk(data);


    const routes =
        routeAgents(
            data,
            anomalies
        );


    updateSnapshot(
        data
    );


    renderAnomalies(
        anomalies
    );


    renderAgents(
        routes
    );


    renderRiskChart(
        data,
        risk
    );


    buildRecommendation(
        data,
        anomalies,
        routes,
        risk
    );


    $("simulationStatus").textContent =
        "COMPLETE";


    $("recommendationStatus").textContent =
        "GENERATED";


    document.querySelectorAll(
        ".orchestrator-node"
    ).forEach(
        node =>
            node.classList.add(
                "active"
            )
    );

}


/* =========================================================
   EVENTS
   ========================================================= */

$("randomize")
    .addEventListener(
        "click",
        randomize
    );


$("runSimulation")
    .addEventListener(
        "click",
        runSimulation
    );


$("facility")
    .addEventListener(
        "change",
        () => {

            const profile =
                facilityProfiles[
                    $("facility").value
                ] || Object.values(facilityProfiles)[0];


            $("energy").value =
                profile.energyBase;

            $("occupancy").value =
                profile.occupancy;

            $("equipment").value =
                profile.equipment;

        }
    );


/* =========================================================
   INITIAL
   ========================================================= */

loadFacilitySelector().catch(console.error);

runSimulation();