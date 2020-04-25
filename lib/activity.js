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