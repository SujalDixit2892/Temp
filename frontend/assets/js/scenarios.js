import { loadFacilitySelector } from "./facilities.js";

let impactChart = null;

const $ = id => document.getElementById(id);

const profiles = {

    "HQ Tower": {
        energy: 640,
        occupancy: 72,
        equipment: 91
    },

    "Operations Center": {
        energy: 720,
        occupancy: 81,
        equipment: 87
    },

    "Manufacturing Plant": {
        energy: 980,
        occupancy: 76,
        equipment: 74
    },

    "Warehouse": {
        energy: 510,
        occupancy: 61,
        equipment: 89
    }

};


/* =========================
   PRESETS
========================= */

const presets = {

    peak: {
        occupancy: 25,
        energy: 30,
        equipment: -5,
        security: 2,
        temperature: 36
    },

    equipment: {
        occupancy: 0,
        energy: 15,
        equipment: -25,
        security: 0,
        temperature: 31
    },

    security: {
        occupancy: 5,
        energy: 5,
        equipment: 0,
        security: 8,
        temperature: 31
    },

    efficiency: {
        occupancy: -5,
        energy: -25,
        equipment: 5,
        security: 0,
        temperature: 28
    }

};


document.querySelectorAll(
    ".scenario-card"
).forEach(button => {

    button.addEventListener(
        "click",
        () => {

            const data =
                presets[
                    button.dataset.scenario
                ];

            $("occupancyChange").value =
                data.occupancy;

            $("energyChange").value =
                data.energy;

            $("equipmentChange").value =
                data.equipment;

            $("securityChange").value =
                data.security;

            $("temperature").value =
                data.temperature;

            $("scenarioState").textContent =
                "CONFIGURED";

        }
    );

});


/* =========================
   ANALYSIS
========================= */

function runScenario() {

    const facility =
        profiles[
            $("facility").value
        ] || Object.values(profiles)[0];


    const occupancy =
        Number(
            $("occupancyChange").value
        );


    const energy =
        Number(
            $("energyChange").value
        );


    const equipment =
        Number(
            $("equipmentChange").value
        );


    const security =
        Number(
            $("securityChange").value
        );


    const temperature =
        Number(
            $("temperature").value
        );


    const price =
        Number(
            $("energyPrice").value
        );


    const baselineEnergy =
        facility.energy;


    const projectedEnergy =
        baselineEnergy *
        (1 + energy / 100) *
        (
            1 +
            Math.max(
                0,
                occupancy
            ) / 250
        );


    const energyDelta =
        (
            (
                projectedEnergy -
                baselineEnergy
            ) /
            baselineEnergy
        ) *
        100;


    const baselineCost =
        baselineEnergy *
        price;


    const projectedCost =
        projectedEnergy *
        price;


    let risk = 20;


    risk +=
        Math.max(
            0,
            energyDelta
        ) *
        0.7;


    risk +=
        Math.max(
            0,
            -equipment
        ) *
        0.9;


    risk +=
        security *
        4;


    risk +=
        Math.max(
            0,
            temperature - 30
        ) *
        1.5;


    risk = Math.min(
        100,
        Math.round(risk)
    );


    const assetPressure =
        Math.min(
            100,
            Math.round(
                25 +
                Math.max(
                    0,
                    -equipment
                ) *
                1.8 +
                Math.max(
                    0,
                    energyDelta
                ) *
                0.4
            )
        );


    const costDelta =
        (
            (
                projectedCost -
                baselineCost
            ) /
            baselineCost
        ) *
        100;


    renderResults(
        energyDelta,
        costDelta,
        risk,
        assetPressure
    );


    renderAgents(
        energyDelta,
        equipment,
        security,
        occupancy,
        risk
    );


    renderDecision(
        energyDelta,
        costDelta,
        risk,
        assetPressure
    );


    renderChart(
        energyDelta,
        costDelta,
        risk,
        assetPressure
    );


    $("scenarioState").textContent =
        "ANALYZED";


    $("decisionStatus").textContent =
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


/* =========================
   RESULTS
========================= */

function renderResults(
    energy,
    cost,
    risk,
    asset
) {

    $("energyImpact").textContent =
        `${energy >= 0 ? "+" : ""}${energy.toFixed(1)}%`;

    $("costImpact").textContent =
        `${cost >= 0 ? "+" : ""}${cost.toFixed(1)}%`;

    $("riskImpact").textContent =
        `${risk}/100`;

    $("assetImpact").textContent =
        `${asset}/100`;

}


/* =========================
   AGENTS
========================= */

function renderAgents(
    energy,
    equipment,
    security,
    occupancy,
    risk
) {

    const affected = [];


    if (
        Math.abs(energy) > 5 ||
        occupancy > 10
    ) {

        affected.push([
            "Energy Agent",
            "Demand and efficiency impact"
        ]);

    }


    if (equipment < -5) {

        affected.push([
            "Maintenance Agent",
            "Asset degradation detected"
        ]);

    }


    if (occupancy > 10) {

        affected.push([
            "Occupancy Agent",
            "Utilization pattern changed"
        ]);

    }


    if (security > 0) {

        affected.push([
            "Security Agent",
            "Security activity changed"
        ]);

    }


    if (
        Math.abs(energy) > 5 ||
        risk > 45
    ) {

        affected.push([
            "Cost Agent",
            "Financial impact requires review"
        ]);

    }


    $("agentCount").textContent =
        `${affected.length} AGENTS`;


    $("affectedAgents").innerHTML =
        affected.length
            ? affected.map(
                item => `

                <div class="agent-row">

                    <div class="agent-icon">
                        ${item[0].charAt(0)}
                    </div>

                    <div class="agent-info">

                        <strong>
                            ${item[0]}
                        </strong>

                        <span>
                            ${item[1]}
                        </span>

                    </div>

                    <span class="agent-state">
                        ANALYSIS REQUIRED
                    </span>

                </div>

            `
            ).join("")
            : `

                <div class="insight">
                    No specialist agent requires
                    additional analysis.
                </div>

            `;

}


/* =========================
   DECISION
========================= */

function renderDecision(
    energy,
    cost,
    risk,
    asset
) {

    let recommendation;


    if (risk >= 75) {

        recommendation =
            "Do not deploy the proposed scenario without mitigation. The projected operational risk is high and requires cross-agent review.";

    }
    else if (risk >= 50) {

        recommendation =
            "Proceed only with monitoring and mitigation controls. The scenario introduces measurable operational and financial pressure.";

    }
    else if (energy < -10) {

        recommendation =
            "The scenario appears favorable. The modeled reduction in energy demand suggests a potential efficiency opportunity.";

    }
    else {

        recommendation =
            "The scenario remains within an acceptable simulated risk range. Continue monitoring the affected operational indicators.";

    }


    $("decision").innerHTML = `

        <div class="ai-output-header">

            <span>
                SCENARIO INTELLIGENCE
            </span>

            <span class="result-status">
                RISK ${risk}/100
            </span>

        </div>


        <div class="ai-output-body">

            <strong>
                Assessment
            </strong>

            <br><br>

            Projected energy impact:
            ${energy >= 0 ? "+" : ""}
            ${energy.toFixed(1)}%

            <br>

            Projected cost impact:
            ${cost >= 0 ? "+" : ""}
            ${cost.toFixed(1)}%

            <br>

            Asset pressure:
            ${asset}/100

            <br><br>

            <strong>
                Recommendation
            </strong>

            <br><br>

            ${recommendation}

        </div>

    `;

}


/* =========================
   CHART
========================= */

function renderChart(
    energy,
    cost,
    risk,
    asset
) {

    if (impactChart)
        impactChart.destroy();


    impactChart =
        new Chart(
            $("impactChart"),
            {

                type: "bar",

                data: {

                    labels: [
                        "Energy",
                        "Cost",
                        "Risk",
                        "Asset"
                    ],

                    datasets: [

                        {
                            label:
                                "Scenario Impact",

                            data: [
                                Math.abs(energy),
                                Math.abs(cost),
                                risk,
                                asset
                            ]
                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,

                    scales: {

                        y: {
                            beginAtZero: true
                        }

                    }

                }

            }
        );

}


/* =========================
   EVENTS
========================= */

$("runScenario")
    .addEventListener(
        "click",
        runScenario
    );


$("facility")
    .addEventListener(
        "change",
        () => {

            $("scenarioState").textContent =
                "DRAFT";

        }
    );


/* =========================
   INITIAL
========================= */

loadFacilitySelector().then(runScenario).catch(console.error);