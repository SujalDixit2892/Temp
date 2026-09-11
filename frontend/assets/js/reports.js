import { loadFacilitySelector } from "./facilities.js";

let performanceChart = null;
let resourceChart = null;

const $ = id => document.getElementById(id);


const profiles = {

    "HQ Tower": {
        energy: 4480,
        cost: 35840,
        savings: 11.8,
        risk: 31,
        asset: 89,
        agents: {
            Energy: 96,
            Maintenance: 91,
            Occupancy: 94,
            Security: 98,
            Cost: 87
        }
    },

    "Operations Center": {
        energy: 5040,
        cost: 40320,
        savings: 9.4,
        risk: 38,
        asset: 85,
        agents: {
            Energy: 93,
            Maintenance: 87,
            Occupancy: 91,
            Security: 96,
            Cost: 84
        }
    },

    "Manufacturing Plant": {
        energy: 6860,
        cost: 54880,
        savings: 15.7,
        risk: 57,
        asset: 72,
        agents: {
            Energy: 91,
            Maintenance: 78,
            Occupancy: 88,
            Security: 94,
            Cost: 82
        }
    },

    "Warehouse": {
        energy: 3570,
        cost: 28560,
        savings: 8.6,
        risk: 24,
        asset: 92,
        agents: {
            Energy: 97,
            Maintenance: 94,
            Occupancy: 96,
            Security: 99,
            Cost: 90
        }
    }

};


function multiplier() {

    return Number(
        $("duration").value
    ) / 7;

}


function refresh() {

    const profile =
        profiles[
            $("facility").value
        ] || Object.values(profiles)[0];


    const factor =
        multiplier();


    $("energy").textContent =
        Math.round(
            profile.energy *
            factor
        ).toLocaleString();


    $("cost").textContent =
        `₹${Math.round(
            profile.cost *
            factor
        ).toLocaleString()}`;


    $("savings").textContent =
        `${profile.savings}%`;


    $("risk").textContent =
        `${profile.risk}/100`;


    $("asset").textContent =
        `${profile.asset}%`;


    renderCharts(
        profile,
        factor
    );


    renderAgents(
        profile
    );


    renderFinancial(
        profile
    );


    renderRisk(
        profile
    );


    renderSummary(
        profile,
        factor
    );

}


function renderCharts(
    profile,
    factor
) {

    const labels = [
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat",
        "Sun"
    ];


    const trend =
        labels.map(
            () =>
                Math.round(
                    profile.energy / 7 *
                    (
                        0.82 +
                        Math.random() * 0.35
                    )
                )
        );


    if (performanceChart)
        performanceChart.destroy();


    performanceChart =
        new Chart(
            $("performanceChart"),
            {

                type: "line",

                data: {

                    labels,

                    datasets: [

                        {
                            label:
                                "Energy Consumption",

                            data:
                                trend,

                            tension:
                                0.35,

                            fill:
                                true
                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false

                }

            }

        );


    if (resourceChart)
        resourceChart.destroy();


    resourceChart =
        new Chart(
            $("resourceChart"),
            {

                type: "doughnut",

                data: {

                    labels: [
                        "Energy",
                        "Maintenance",
                        "Occupancy",
                        "Security",
                        "Other"
                    ],

                    datasets: [

                        {
                            data: [
                                34,
                                22,
                                18,
                                12,
                                14
                            ]
                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false

                }

            }

        );

}


function renderAgents(
    profile
) {

    $("agentPerformance").innerHTML =
        Object.entries(
            profile.agents
        )
        .map(
            ([agent, score]) => `

            <div class="agent-row">

                <div class="agent-icon">
                    ${agent.charAt(0)}
                </div>

                <div class="agent-info">

                    <strong>
                        ${agent} Agent
                    </strong>

                    <span>
                        Intelligence contribution
                    </span>

                </div>


                <div
                    style="
                        margin-left:auto;
                        min-width:170px;
                        text-align:right;
                    "
                >

                    <strong>
                        ${score}%
                    </strong>

                    <br>

                    <span class="agent-state">
                        PERFORMANCE
                    </span>

                </div>

            </div>

        `
        ).join("");

}


function renderFinancial(
    profile
) {

    const monthly =
        Math.round(
            profile.cost *
            4 *
            (
                profile.savings /
                100
            )
        );


    $("financialImpact").innerHTML = `

        <div class="insight">

            <strong>
                Estimated optimization opportunity
            </strong>

            <br><br>

            Current modeled savings potential:
            <strong>
                ${profile.savings}%
            </strong>

            <br><br>

            Approximate monthly opportunity:
            <strong>
                ₹${monthly.toLocaleString()}
            </strong>

            <br><br>

            Primary contributors include energy
            optimization, equipment efficiency and
            operational scheduling.

        </div>

    `;

}


function renderRisk(
    profile
) {

    let priority;

    if (profile.risk >= 60)
        priority = "Immediate operational review";

    else if (profile.risk >= 40)
        priority = "Enhanced monitoring required";

    else
        priority = "Normal operational monitoring";


    $("riskOutlook").innerHTML = `

        <div class="insight">

            <strong>
                Composite risk:
                ${profile.risk}/100
            </strong>

            <br><br>

            Asset health:
            ${profile.asset}%

            <br><br>

            Priority:
            <strong>
                ${priority}
            </strong>

            <br><br>

            The risk profile combines operational,
            asset, security and financial signals.

        </div>

    `;

}


function renderSummary(
    profile,
    factor
) {

    let assessment;


    if (profile.risk >= 55) {

        assessment =
            "The facility requires enhanced operational attention. Asset condition and elevated risk should be prioritized while the energy and cost optimization opportunities are evaluated.";

    }
    else if (profile.savings >= 12) {

        assessment =
            "The facility shows a strong optimization opportunity. Energy efficiency and cost reduction should be prioritized while maintaining current asset reliability.";

    }
    else {

        assessment =
            "The facility is operating within a generally stable range. Continued monitoring combined with targeted efficiency improvements should maintain performance.";

    }


    $("executiveSummary").innerHTML = `

        <div class="ai-output-header">

            <span>
                EXECUTIVE INTELLIGENCE
            </span>

            <span class="result-status">
                GENERATED
            </span>

        </div>


        <div class="ai-output-body">

            <strong>
                Executive assessment
            </strong>

            <br><br>

            ${assessment}

            <br><br>

            <strong>
                Key indicators
            </strong>

            <br><br>

            Energy consumption:
            ${Math.round(
                profile.energy * factor
            ).toLocaleString()} kWh

            <br>

            Estimated operating cost:
            ₹${Math.round(
                profile.cost * factor
            ).toLocaleString()}

            <br>

            Savings opportunity:
            ${profile.savings}%

            <br>

            Facility risk:
            ${profile.risk}/100

            <br>

            Asset health:
            ${profile.asset}%

            <br><br>

            <strong>
                Recommended management focus
            </strong>

            <br><br>

            Prioritize the highest-impact operational
            signals, use agent recommendations to guide
            corrective action and continuously monitor
            financial and asset-level outcomes.

        </div>

    `;

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


$("refreshReport")
    .addEventListener(
        "click",
        refresh
    );


$("generateReport")
    .addEventListener(
        "click",
        () => {

            refresh();

            $("reportStatus").textContent =
                "GENERATED";

        }
    );


loadFacilitySelector().then(refresh).catch(console.error);