// Chrome Extension API modifications for async
chrome.tabs.queryAsync = query => new Promise(resolve => {
    chrome.tabs.query(query, tabs => {
        if (tabs.length === 0)
            throw 'Could not find any tabs';
        resolve(tabs[0].id);
    });
});

// Global
var Settings = {};
var TrackedDomains = {};

// For active tab tracking
var PreviousTrackedTab = {
    Id: null,
    Domain: null,
    Update(tabId, domain) {
        this.Id = tabId;
        this.Domain = domain;
    }
};

// For tracking all tabs
var TabDomains = {};

// Helper Classes
function TrackingInfo(domain) {
    var self = this;
    self.Domain = domain;
    
    self.IsCurrentlyTracked = () => Settings.onlyTrackActiveTab === false && Object.keys(TabDomains).some(domain => TabDomains[domain] === self.Domain);
    
    self.StartTime;

    self.Reset = () => {
        self.StartTime = null;
    };

    self.Reset();
}

// --------------- Helpers --------------- //
// Install / Setup
function ConstructTrackedDomains(settings) {
    let trackedDomains = {};
    for (let i = 0; i < settings.domains.length; i++) {
        const domain = settings.domains[i];
        trackedDomains[domain] = new TrackingInfo(domain);
    }

    return trackedDomains;
}

function getDomainFromTabIdAsync(tabId) {
    return new Promise(resolve => {
        if (tabId === null) {
            resolve('');
            return;
        }

        chrome.tabs.get(+tabId, tab => {
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

function StartTracking(tabId, domain) {
    // If the same tab switched from one tracked domain to the other,
    // stop tracking it as the old domain
    if (TabDomains[tabId] !== undefined && TabDomains[tabId] !== domain)
        StopTracking(tabId);

    TabDomains[tabId] = domain;

    PreviousTrackedTab.Update(tabId, domain);

    // Silently return it's irrelevant
    if (TrackedDomains.hasOwnProperty(domain) === false)
        return;

    // Update TrackedDomains dictionary
    if(TrackedDomains[domain].StartTime === null) {
        TrackedDomains[domain].StartTime = new Date();
        console.log('now tracking domain: "' + domain + '"');
    }
};

function StopTracking(tabId) {
    let domain = TabDomains[tabId];

    // This tab no longer is on this domain
    delete TabDomains[tabId];

    // Silently return, it's not a real domain or it's currently being tracked elsewhere
    if (TrackedDomains.hasOwnProperty(domain) === false 
        || TrackedDomains[domain].IsCurrentlyTracked() === true)
        return;

    let stopTime = new Date();
    let startTime = TrackedDomains[domain].StartTime;
    let differenceInMs = stopTime - startTime;
    let differenceInSeconds = Math.floor(differenceInMs / 1000);

    // Each entry id is aggregated by "{currentDay}-{domain}"
    let id = getCurrentDateForId() + '-' + domain;
    let saveData = {};
    saveData[id] = differenceInMs;

    chrome.storage.sync.get(id, items => {
        if (items.hasOwnProperty(id))
            saveData[id] += items[id];
        chrome.storage.sync.set(saveData);
    });

    TrackedDomains[domain].Reset();

    console.log('stopped tracking domain: "' + domain + '"');
};

// ----------- Extension Events ---------- //
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

    TrackedDomains = ConstructTrackedDomains(Settings);

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
        TrackedDomains = ConstructTrackedDomains(Settings);

        console.log('----- STATUS: Started')
    });
});

// Settings changes
chrome.storage.onChanged.addListener((changes, areaName) => {
    // This block updates settings
    if (changes.hasOwnProperty('settings')) {
        // Get the new settings values
        Settings = changes['settings'].newValue || changes['settings'].oldValue;

        // Update the tracking info
        // Delete removed domains
        for (const domain in TrackedDomains)
            if (TrackedDomains.hasOwnProperty(domain) && Settings.domains.includes(domain) === false)
                delete TrackedDomains[domain];

        // Setup added domains
        for (let i = 0; i < Settings.domains.length; i++) {
            const domain = Settings.domains[i];
            if (TrackedDomains.hasOwnProperty(domain) === false)
                TrackedDomains[domain] = new TrackingInfo();
        }

        // Deal with currently tracked items

    }
});

chrome.tabs.onActivated.addListener(async activeInfo => {
    console.log('--- onActivated');
    let domain = await getDomainFromTabIdAsync(activeInfo.tabId);
    
    // Only stop tracking if the setting is set to "Active"
    if (Settings.onlyTrackActiveTab === true)
        // Stop tracking previous active tab
        StopTracking(PreviousTrackedTab.Id);

    // Only track if domain is in settings list and domain has changed
    if (Settings.domains.includes(domain) === true)
        StartTracking(activeInfo.tabId, domain);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') return;

    console.log('--- onUpdated');
    let domain = await getDomainFromTabIdAsync(tabId);

    // Only track if domain is in settings list
    if (Settings.domains.includes(domain) === true)
        StartTracking(tabId, domain);
    else
        StopTracking(tabId);
});

// When closing a tab
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    StopTracking(tabId);
});

// ONLY MATTERS FOR onlyTrackActiveTab = true
// Updates
chrome.windows.onFocusChanged.addListener(async windowId => {
    console.log('--- onFocusChanged');

    // Get tabId and domain
    let tabId = await chrome.tabs.queryAsync({
        active: true,
        windowId: windowId
    });

    // We're tracking active tab
    if (Settings.onlyTrackActiveTab === true) {
        StopTracking(PreviousTrackedTab.Id);

        // Tracking active tab and the focus is still on a Chrome window
        if (windowId !== chrome.windows.WINDOW_ID_NONE) {
            let domain = await getDomainFromTabIdAsync(tabId);
            if (Settings.domains.includes(domain) === true)
                StartTracking(tabId, domain);
        }
    }
});