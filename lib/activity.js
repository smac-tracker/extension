/// <reference path="../thirdparty/knockout-3.5.1.js"/>
var background;

chrome.runtime.getBackgroundPageAsync = () => new Promise(resolve => {
    chrome.runtime.getBackgroundPage(backgroundPage => {
        resolve(backgroundPage);
    });
});

$(document).ready(async () => {
    background = await chrome.runtime.getBackgroundPageAsync();
    ko.applyBindings(new ActivityPageVm());
});

var RandomColors = (function () {

    function __getRandomColor() {
        var r = Math.floor(Math.random() * 255);
        var g = Math.floor(Math.random() * 255);
        var b = Math.floor(Math.random() * 255);
        var a = Math.random();
        if (a < 0.2) a += 0.2;
        return "rgba(" + r + "," + g + "," + b + "," + a + ")";
    }

    return {
        /**
         * 
         * @param {number} arrLength 
         */
        GetArray: function (arrLength) {
            var arr = []
            for (let i = 0; i < arrLength; i++) {
                arr.push(__getRandomColor())
            }
            return arr;
        },
        GetColor: function () {
            return __getRandomColor();
        }
    };
})();

function ActivityPageVm() {
    var self = this;
    self.IsLoading = ko.observable(false);

    self.Domains = ko.observableArray([]);
    self.OnlyTrackActiveTab = ko.observable();

    var oneWeekBackDate = new Date();
    oneWeekBackDate.setDate(oneWeekBackDate.getDate() - 7);
    self.StartDate = ko.observable(oneWeekBackDate);
    var endDate = new Date();
    self.EndDate = ko.observable(endDate);
    self.NewDomain = ko.observable();
    self.TodaysMinutes = ko.observable();

    self.Charts = ko.observableArray([]);
    self.ActivityData = ko.observable();
    self.TodaysData = ko.observable();

    self.LoadChartData = async function () {
        var data = {}
        var numDays = Math.ceil((self.EndDate().getTime() - self.StartDate().getTime()) / (1000.0 * 3600.0 * 24.0));
        for (let i = 0; i < numDays + 1; i++) {
            var date = new Date(self.StartDate())
            date.setDate(date.getDate() + i);
            var dateCode = date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate();
            data[dateCode] = {}
            for (let j = 0; j < self.Domains().length; j++) {
                var minutes = 0
                var key = dateCode + '-' + self.Domains()[j];

                results = await background.chrome.storage.sync.getAsync(key);
                if (results[key] !== null && results[key] !== undefined &&
                    typeof results[key] === 'number') {
                    minutes = (results[key] / 60.0);
                }

                data[dateCode][self.Domains()[j]] = minutes;
            }
        }

        self.ActivityData(data);
        console.log(data);
    };

    self.LoadTodaysData = async function () {
        var date = new Date();
        var dateCode = date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate();
        var totalMins = 0;
        for (let i = 0; i < self.Domains().length; i++) {
            var key = dateCode + '-' + self.Domains()[i];
            results = await background.chrome.storage.sync.getAsync(key);
            if (results[key] !== null && results[key] !== undefined &&
                typeof results[key] === 'number') {
                totalMins += (results[key] / 60.0);
            }
        }
        self.TodaysMinutes(totalMins);
    }

    self.SaveSettings = async () => {
        if (self.IsLoading() === true) return;
        self.IsLoading(true);

        let saveData = {
            settings: {
                domains: self.Domains(),
                onlyTrackActiveTab: self.OnlyTrackActiveTab()
            }
        };
        await background.chrome.storage.sync.set(saveData);
        self.IsLoading(false);
    };

    self.DeleteDomain = function (domain) {
        self.Domains.remove(domain);
        background.Settings.RemoveDomain(domain);
        self.SaveSettings();
    }

    self.AddDomain = function () {
        if (self.Domains().includes(self.NewDomain()) === false) {
            self.Domains.push(self.NewDomain());
            background.Settings.AddDomain(self.NewDomain());
            self.SaveSettings();
        }
    }

    // Save tracking preference as soon as it changes
    self.OnlyTrackActiveTab.subscribe(function () {
        self.SaveSettings();
    });

    self.TodaysConsumptionText = ko.computed(function () {
        var globalaverageConsumption = 144;
        if (self.TodaysMinutes() < 134)
            return 'Below Average';
        else if (self.TodaysMinutes() < 154)
            return 'Average';
        else
            return 'Above Average';
    });

    self.PieChartData = ko.computed(function () {
        var labels = self.Domains();
        var domainMinutes = []
        var data = {}
        for (var day in self.ActivityData()) {
            for (let d = 0; d < labels.length; d++) {
                if (data.hasOwnProperty(labels[d]))
                    data[labels[d]] += self.ActivityData()[day][labels[d]];
                else
                    data[labels[d]] = self.ActivityData()[day][labels[d]];
            }
        }

        for (var domain in data)
            domainMinutes.push(data[domain])

        return {
            labels: Array.from(labels),
            datasets: [{
                label: 'minutes',
                data: domainMinutes,
                backgroundColor: RandomColors.GetArray(labels.length)
            }]
        }
    });

    self.BarTimeData = ko.computed(function () {
        var labels = []
        var dayMinutes = []
        for (var day in self.ActivityData()) {
            labels.push(day)
            var mins = 0
            for (var domain in self.ActivityData()[day]) {
                mins += self.ActivityData()[day][domain]
            }
            dayMinutes.push(mins)
        }

        return {
            labels: labels,
            datasets: [{
                label: 'minutes',
                data: dayMinutes,
                backgroundColor: RandomColors.GetArray(labels.length)
            }]
        }
    });

    self.LoadSettings = async () => {
        if (self.IsLoading() === true) return;
        self.IsLoading(true);

        var results = await background.chrome.storage.sync.getAsync('settings');
        console.log(results);
        self.Domains(results.settings.domains);
        self.OnlyTrackActiveTab(results.settings.onlyTrackActiveTab);
        self.IsLoading(false);
        self.LoadChartData();
        self.LoadTodaysData();
    };

    self.LoadSettings();

    self.Charts.push(new ChartVm(self, 'pie', 'Pie', self.PieChartData, {
        observeChanges: true,
        throttle: 100,
    }, true));

    self.Charts.push(new ChartVm(self, 'horizontalBar', 'Bar', self.PieChartData, {
        observeChanges: true,
        throttle: 100,
        scales: {
            yAxes: [{
                ticks: {
                    beginAtZero: true
                },
                scaleLabel: {
                    display: true,
                    labelString: 'website'
                }
            }],
            xAxes: [{
                scaleLabel: {
                    display: true,
                    labelString: 'minutes'
                }
            }]
        },
        legend: {
            display: false
        }
    }));

    self.Charts.push(new ChartVm(self, 'bar', 'Bar - time', self.BarTimeData, {
        observeChanges: true,
        throttle: 100,
        scales: {
            yAxes: [{
                ticks: {
                    beginAtZero: true
                },
                scaleLabel: {
                    display: true,
                    labelString: 'minutes'
                }
            }],
            xAxes: [{
                scaleLabel: {
                    display: true,
                    labelString: 'day'
                }
            }]
        },
        legend: {
            display: false
        }
    }));
}

function ChartVm(objParent, chartType, chartButtonText, objChartData, chartOptions, showByDefault = false) {
    var self = this;

    self.Parent = objParent;
    self.ChartType = ko.observable(chartType);
    self.ChartButtonText = ko.observable(chartButtonText);
    self.IsVisible = ko.observable(showByDefault);
    self.ChartData = objChartData;
    self.ChartOptions = chartOptions;

    self.ButtonCss = ko.computed(function () {
        if (self.IsVisible() === true)
            return 'btn btn-primary';
        return 'btn btn-secondary';
    })

    self.OnClick = function () {
        if (self.IsVisible() === true) return;
        for (let i = 0; i < self.Parent.Charts().length; i++) {
            self.Parent.Charts()[i].IsVisible(false);
        }
        self.IsVisible(true);
    }
}