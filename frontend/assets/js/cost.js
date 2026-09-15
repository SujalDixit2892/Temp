import { loadFacilitySelector } from "./facilities.js";

const API = "http://127.0.0.1:8000/api";

let costChart = null;
let breakdownChart = null;
let benchmarkChart = null;

const $ = id => document.getElementById(id);


/* =========================================================
   FACILITIES
   ========================================================= */

async function loadFacilities() {
    await loadFacilitySelector();
    calculateCost();
}


/* =========================================================
   COST MODEL
   ========================================================= */

function calculateCost() {

    const duration = Number($("duration").value);

    /*
     * Demo financial model.
     *
     * Once the backend cost endpoint is available,
     * this function becomes the adapter for the real data.
     */

    const baseDailyEnergy = 12000;

    const tariff = 8;

    const energyCost =
        baseDailyEnergy * tariff;

    const maintenanceCost =
        8500;

    const operationsCost =
        5200;

    const daily =
        energyCost +
        maintenanceCost +
        operationsCost;

    const monthly =
        daily * 30;

    const opportunity =
        daily * 0.12;

    const share =
        (energyCost / daily) * 100;


    $("dailyCost").textContent =
        formatCurrency(daily);

    $("monthlyCost").textContent =
        formatCurrency(monthly);

    $("savings").textContent =
        formatCurrency(opportunity);

    $("energyShare").textContent =
        `${share.toFixed(0)}%`;

    $("status").textContent =
        "ANALYZED";


    renderCharts(
        daily,
        energyCost,
        maintenanceCost,
        operationsCost,
        duration
    );

    renderOpportunities(
        energyCost,
        maintenanceCost,
        operationsCost
    );

}


/* =========================================================
   CHARTS
   ========================================================= */

function renderCharts(
    daily,
    energyCost,
    maintenanceCost,
    operationsCost,
    duration
) {

    const labels =
        Array.from(
            { length: Math.min(duration, 30) },
            (_, i) => `D${i + 1}`
        );


    const trend =
        labels.map((_, i) =>
            Math.round(
                daily * (0.98 + (Math.random() * 0.04 - 0.02) + (i * 0.001))
            )
        );


    if (costChart)
        costChart.destroy();


    costChart = new Chart(
        $("costChart"),
        {
            type: "line",

            data: {
                labels,

                datasets: [
                    {
                        label: "Operating Cost",

                        data: trend,

                        tension: 0.35
                    }
                ]
            },

            options: {
                responsive: true,

                maintainAspectRatio: false,

                interaction: {
                    mode: "index",
                    intersect: false
                },

                plugins: {
                    legend: {
                        position: "bottom"
                    }
                }
            }
        }
    );


    if (breakdownChart)
        breakdownChart.destroy();


    breakdownChart = new Chart(
        $("breakdownChart"),
        {
            type: "doughnut",

            data: {
                labels: [
                    "Energy",
                    "Maintenance",
                    "Operations"
                ],

                datasets: [
                    {
                        data: [
                            energyCost,
                            maintenanceCost,
                            operationsCost
                        ]
                    }
                ]
            },

            options: {
                responsive: true,

                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        position: "bottom"
                    }
                }
            }
        }
    );


    if (benchmarkChart)
        benchmarkChart.destroy();


    benchmarkChart = new Chart(
        $("benchmarkChart"),
        {
            type: "bar",

            data: {
                labels: [
                    "Selected Facility",
                    "Portfolio Avg",
                    "Best Performing"
                ],

                datasets: [
                    {
                        label: "Daily Cost",

                        data: [
                            daily,
                            daily * 1.08,
                            daily * 0.82
                        ]
                    }
                ]
            },

            options: {
                responsive: true,

                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        }
    );

}


/* =========================================================
   OPPORTUNITIES
   ========================================================= */

function renderOpportunities(
    energy,
    maintenance,
    operations
) {

    const opportunities = [

        {
            title: "Energy optimization",
            value: energy * 0.10,
            text:
                "Reduce avoidable consumption through HVAC scheduling and load optimization."
        },

        {
            title: "Predictive maintenance",
            value: maintenance * 0.08,
            text:
                "Prioritize high-risk assets to reduce reactive maintenance expenditure."
        },

        {
            title: "Operating-hour optimization",
            value: operations * 0.12,
            text:
                "Align operating schedules with occupancy patterns to reduce unnecessary runtime."
        }

    ];


    $("opportunities").innerHTML =
        opportunities.map(item => `

            <div class="insight">

                <div style="
                    display:flex;
                    justify-content:space-between;
                    gap:15px;
                    margin-bottom:5px;
                ">

                    <strong>${item.title}</strong>

                    <strong>
                        ${formatCurrency(item.value)}
                    </strong>

                </div>

                <span>
                    ${item.text}
                </span>

            </div>

        `).join("");
}


/* =========================================================
   SCENARIO SIMULATOR
   ========================================================= */

function runScenario() {

    const energy =
        Number($("scenarioEnergy").value);

    const tariff =
        Number($("tariff").value);

    const hours =
        Number($("operatingHours").value);

    const efficiency =
        Number($("efficiency").value);


    if (
        !Number.isFinite(energy) ||
        !Number.isFinite(tariff) ||
        !Number.isFinite(hours) ||
        !Number.isFinite(efficiency)
    ) {

        $("scenarioStatus").textContent =
            "INVALID";

        $("scenarioResult").textContent =
            "Please enter valid numeric values.";

        return;
    }


    const baselineCost =
        energy * tariff;


    const optimizedEnergy =
        energy *
        (1 - efficiency / 100);


    const optimizedCost =
        optimizedEnergy *
        tariff;


    const savings =
        baselineCost -
        optimizedCost;


    const annualSavings =
        savings * 365;


    $("scenarioStatus").textContent =
        "COMPLETE";


    $("scenarioResult").innerHTML = `

        <strong>
            Estimated savings:
            ${formatCurrency(savings)} / day
        </strong>

        <br><br>

        Baseline:
        ${energy.toLocaleString()} kWh →
        ${formatCurrency(baselineCost)}

        <br>

        Optimized:
        ${optimizedEnergy.toLocaleString(undefined,{
            maximumFractionDigits:0
        })} kWh →
        ${formatCurrency(optimizedCost)}

        <br><br>

        Estimated annual opportunity:
        <strong>
            ${formatCurrency(annualSavings)}
        </strong>

    `;


    $("recommendation").innerHTML = `

        <div class="insight">

            <strong>
                Recommended action
            </strong>

            <br><br>

            A ${efficiency}% efficiency improvement would
            reduce estimated energy expenditure by
            ${formatCurrency(savings)} per operating day.

        </div>

        <div class="insight">

            <strong>
                Operating schedule
            </strong>

            <br><br>

            Current simulated operating window:
            ${hours} hours/day.

            Consider aligning HVAC and other
            energy-intensive systems with actual occupancy.

        </div>

    `;
}


/* =========================================================
   HELPERS
   ========================================================= */

function formatCurrency(value) {

    return new Intl.NumberFormat(
        "en-IN",
        {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0
        }
    ).format(value);

}


/* =========================================================
   EVENTS
   ========================================================= */

$("duration").addEventListener(
    "change",
    calculateCost
);

$("facility").addEventListener(
    "change",
    calculateCost
);

$("runScenario").addEventListener(
    "click",
    runScenario
);


/* =========================================================
   INITIALIZE
   ========================================================= */

loadFacilities().catch(error => {

    console.error(error);

    $("status").textContent =
        "DEMO MODE";

    calculateCost();

});