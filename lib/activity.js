/// <reference path="../thirdparty/knockout-3.5.1.js"/>

$(document).ready(() => {
    ko.applyBindings(new ActivityPageVm());
});

function ActivityPageVm() {
    var self = this;
    self.IsLoading = ko.observable(false);

    self.Settings = ko.observable(new Settings(self.IsLoading));
    self.Domains = self.Settings().Domains;
    self.OnlyTrackActiveTab = self.Settings().OnlyTrackActiveTab;

    self.StartDate = ko.observable(new Date());
    self.EndDate = ko.observable(new Date());
    self.DatepickerOptions = {
        format: "mm-dd-yyyy"
    }
    self.Activities = ko.observableArray([]);
    // console.log(self.Settings().Domains());

    self.TodaysTotal = function () {
        var averageConsumption = 147; //minutes; From google
    }
    
    self.ChartData = {
        labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Orange'],
        datasets: [{
            label: '# of Votes',
            data: [12, 19, 3, 5, 2, 3],
            backgroundColor: [
                'rgba(255, 99, 132, 0.2)',
                'rgba(54, 162, 235, 0.2)',
                'rgba(255, 206, 86, 0.2)',
                'rgba(75, 192, 192, 0.2)',
                'rgba(153, 102, 255, 0.2)',
                'rgba(255, 159, 64, 0.2)'
            ],
            borderColor: [
                'rgba(255, 99, 132, 1)',
                'rgba(54, 162, 235, 1)',
                'rgba(255, 206, 86, 1)',
                'rgba(75, 192, 192, 1)',
                'rgba(153, 102, 255, 1)',
                'rgba(255, 159, 64, 1)'
            ],
            borderWidth: 1
        }]
    }
}

function Settings(obsIsLoading) {
    var self = this;
    self.IsLoading = obsIsLoading;

    self.Domains = ko.observableArray();
    self.OnlyTrackActiveTab = ko.observable();

    self.Load = () => {
        if (self.IsLoading() === true) return;
        self.IsLoading(true);

        chrome.storage.sync.get('settings', items => {
            self.Domains(items.settings.domains);
            self.OnlyTrackActiveTab(items.settings.onlyTrackActiveTab);

            self.IsLoading(false);
        });

    };

    self.Save = () => {
        if (self.IsLoading() === true) return;
        self.IsLoading(true);

        let saveData = {
            domains: self.Domains(),
            onlyTrackActiveTab: self.OnlyTrackActiveTab()
        };
        chrome.storage.sync.set(saveData, () => {
            self.IsLoading(false);

            self.Load();
        });
    };

    self.Load();
};

function Activity(activity) {
    var self = this;
};