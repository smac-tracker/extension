// Global
var Settings = null;
var Tabs = {
    previouslyActiveDomain: null,
    oldActiveTabId: null
};

// Helper functions
function getDomainFromTabIdAsync(tabId) {
    return new Promise(resolve => {
        if (tabId === null) {
            resolve('');
            return;
        }

        chrome.tabs.get(+tabId, tab => {
            console.log('tabid: ' + tabId);
            console.log('error: ');
            console.log(chrome.runtime.lastError);
            let strUrl = tab.hasOwnProperty('pendingUrl') ? tab.pendingUrl : tab.url;
            let objUrl = new URL(strUrl);
            resolve(objUrl.hostname);
        });
    });
}

function getCurrentDateForId() {
    let today = new Date();
    return today.getFullYear() + '/' + (today.getMonth() + 1) + '/' + today.getDate();
}

function TrackingInfo(tabId, domain) {
    var self = this;

    self.StartTime = new Date();
    self.Domain = domain;
}


function StartTracking(tabId, domain) {
    // Silently return, it's already being tracked
    if (Tabs.hasOwnProperty(tabId) === true)
        return;
    console.log('Started tracking: ' + tabId);

    Tabs[tabId] = new TrackingInfo(tabId, domain);
};

function StopTracking(tabId) {
    // Silently return, it's done or irrelevant
    if (Tabs.hasOwnProperty(tabId) === false)
        return;

    console.log('Stopped tracking: ' + tabId);
    let tab = Tabs[tabId];

    let stopTime = new Date();
    let startTime = tab.StartTime;
    let differenceInMs = stopTime - startTime;
    let differenceInSeconds = Math.floor(differenceInMs / 1000);

    // Each entry id is aggregated by "{currentDay}-{domain}"
    let id = getCurrentDateForId() + '-' + tab.Domain;
    let saveData = {};
    saveData[id] = differenceInMs;
    
    chrome.storage.sync.get(id, items => {
        if(items.hasOwnProperty(id))
            saveData[id] += items[id];
        chrome.storage.sync.set(saveData);
    });
};

// Setup
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.clear();

    // Set initial settings
    Settings = {
        onlyTrackActiveTab: true,
        domains: [
            'www.facebook.com',
            'twitter.com',
            'reddit.com',
            'instagram.com'
        ]
    };

    chrome.storage.sync.set({
        'settings': Settings
    });

    console.log('----- STATUS: Installed');
});

// Startup
chrome.runtime.onStartup.addListener(() => {
    // Load URLs from storage
    chrome.storage.sync.get('settings', (items) => {
        Settings = items;
        console.log(Settings);
    });
});

// Settings changes
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (changes.hasOwnProperty('settings')) {
        Settings = changes['settings'].newValue;

        // Deal with currently tracked items

    }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    // Only track if the setting is set to "Active"
    if (Settings.onlyTrackActiveTab === true) {
        console.log('onActivated');
        let domain = await getDomainFromTabIdAsync(activeInfo.tabId);
        let oldActiveDomain = await getDomainFromTabIdAsync(Tabs.oldActiveTabId);

        // Stop tracking previous active tab (if the domain changed, otherwise keep trackin')
        // If the active tab was closed, can double fire with the "onRemoved" listener
        if (oldActiveDomain !== domain)
            StopTracking(Tabs.oldActiveTabId);

        // Only track if domain is in settings list and domain has changed
        if (Settings.domains.includes(domain) === true) {
            Tabs.oldActiveTabId = activeInfo.tabId;
            StartTracking(activeInfo.tabId, domain);
        }
    }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    console.log('onUpdated');
    let domain = await getDomainFromTabIdAsync(tabId);

    // Only track if domain is in settings list
    if (Settings.domains.includes(domain) === true) {
        StartTracking(tabId, domain);
    }
    else {
        StopTracking(tabId);
    }
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    StopTracking(tabId, await getDomainFromTabIdAsync(tabId));
});