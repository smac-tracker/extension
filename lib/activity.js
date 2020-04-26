/// <reference path="../thirdparty/knockout-3.5.1.js"/>

$(document).ready(() => {
    ko.applyBindings(new ActivityPageVm());
});

var RandomColors = (function () {

    function __getRandomColor() {
        var r = Math.floor(Math.random() * 255);
        var g = Math.floor(Math.random() * 255);
        var b = Math.floor(Math.random() * 255);
        var a = Math.random();
        if(a < 0.2) a += 0.2;
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

    self.Settings = ko.observable(new Settings(self.IsLoading));
    self.Domains = self.Settings().Domains;
    self.OnlyTrackActiveTab = self.Settings().OnlyTrackActiveTab;

    var oneWeekBackDate = new Date();
    oneWeekBackDate.setDate(oneWeekBackDate.getDate() - 7);
    self.StartDate = ko.observable(oneWeekBackDate);
    self.EndDate = ko.observable(new Date());
    self.StartDateOptions = {
        endDate: new Date()
    }
    self.EndDateOptions = ko.pureComputed(function(){
        var options = {
            startDate: self.StartDate(),
            endDate: new Date()
        }
        return options;
    });
    self.NewDomain = ko.observable();

    self.Activities = ko.observableArray([]);
    // console.log(self.Settings().Domains());

    self.ChartData = {
        labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Orange'],
        datasets: [{
            label: '# of Votes',
            data: [12, 19, 3, 5, 2, 3],
            backgroundColor: RandomColors.GetArray(6)
        }]
    }

    self.DeleteDomain = function (domain) {
        self.Domains.remove(domain);
    }

    self.AddDomain = function () {
        if (self.Domains().includes(self.NewDomain()) === false)
            self.Domains.push(self.NewDomain())
    }

    self.LoadChartData = ko.computed(function () {
        chrome.storage.sync.get(['2020/4/25-ommkoeobjkljfcbomdmjlkedkpccahag','2020/4/25-www.youtube.com','test'], items => {
            console.log(items);
        });
    })

    self.CraftDateKeys
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
            settings: {
                domains: self.Domains(),
                onlyTrackActiveTab: self.OnlyTrackActiveTab()
            }
        };
        chrome.storage.sync.set(saveData, () => {
            self.IsLoading(false);

            self.Load();
        });
    };


    // If domains list change, save it instantly
    self.Domains.subscribe(function () {
        self.Save();
    });

    // Save tracking preference as soon as it changes
    self.OnlyTrackActiveTab.subscribe(function () {
        self.Save();
    });

    self.Load();
};

function Activity(activity) {
    var self = this;
};