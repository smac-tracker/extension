$(document).ready(() => {
    ko.applyBindings(new PopupVm());
});

function ActivityPageVm() {
    var self = this;
    self.IsLoading = ko.observable(false);

    self.Settings = ko.observable(new Settings());
    self.Activities = ko.observableArray([]);
}

function Settings(obsIsLoading) {
    var self = this;
    self.IsLoading = obsIsLoading;

    self.Domains = ko.observableArray(settings.domains);
    self.OnlyTrackActiveTab = ko.observable(settings.onlyTrackActiveTab);

    self.Load = () => {
        if (self.IsLoading() === true) return;
        self.IsLoading(true);

        chrome.storage.get('settings', items => {
            self.Domains(items.Domains);
            self.OnlyTrackActiveTab(items.onlyTrackActiveTab);

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
        chrome.storage.set(saveData, () => {
            self.IsLoading(false);

            self.Load();
        });
    };

    self.Load();
};

function Activity(activity) {
    var self = this;
};