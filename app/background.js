// Chrome Extension API modifications for async
chrome.tabs.queryAsync = query => new Promise(resolve => {
    chrome.tabs.query(query, tabs => {
        resolve(tabs);
    });
});

chrome.windows.getCurrentAsync = getInfo => new Promise(resolve => {
    chrome.windows.getCurrent(getInfo, window => resolve(window));
});

chrome.storage.sync.getAsync = keys => new Promise(resolve => {
    chrome.storage.sync.get(keys, items => resolve(items));
});

chrome.storage.sync.setAsync = items => new Promise(resolve => {
    chrome.storage.sync.set(items, () => resolve());
});

// Global
var Settings = (() => {
    var instance = null;

    function CreateInstance() {
        var self = this;
        self.onlyTrackActiveTab = true;
        self.domains = [];
    
        self.Update = settings => {
            self.onlyTrackActiveTab = settings.onlyTrackActiveTab;
            self.domains = settings.domains;
        };
    
        self.HasDomain = domain => self.domains.includes(domain);
        self.AddDomain = domain => {
            console.log(this);
            if(self.HasDomain(domain) === true) return false;
    
            self.domains.push(domain);
        };
        self.RemoveDomain = domain => {
            if(self.HasDomain(domain) === false) return false;
    
            self.domains.splice(self.domains.indexOf(domain), 1);
        };
    
        self.Save = async () => {
            let saveData = {
                'settings': {
                    onlyTrackActiveTab: self.onlyTrackActiveTab,
                    domains: self.domains
                }
            };
    
            await chrome.storage.sync.setAsync(saveData);
        };

        return self;
    }

    return (() => {
        if(instance === null)
            instance = new CreateInstance();
        return Object.freeze(instance);
    })();
})();

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

function getDomainFromUrl(url) {
    let objUrl = new URL(url);
    return objUrl.hostname;
}

function getDomainFromTabIdAsync(tabId) {
    return new Promise(resolve => {
        if (tabId === null) {
            resolve('');
            return;
        }

        chrome.tabs.get(+tabId, tab => {
            let strUrl = tab.hasOwnProperty('pendingUrl') ? tab.pendingUrl : tab.url;
            resolve(getDomainFromUrl(strUrl));
        });
    });
}

function getCurrentDateForId() {
    let today = new Date();
    return today.getFullYear() + '/' + (today.getMonth() + 1) + '/' + today.getDate();
}

// Tracking
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
    let differenceInMs = stopTime.getTime() - startTime.getTime();
    let differenceInSeconds = Math.floor(differenceInMs / 1000.0);

    // Each entry id is aggregated by "{currentDay}-{domain}"
    let id = getCurrentDateForId() + '-' + domain;
    let saveData = {};
    saveData[id] = differenceInSeconds;

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
chrome.runtime.onInstalled.addListener(async () => {
    chrome.storage.sync.clear();

    // Set initial settings
    Settings.Update({
        onlyTrackActiveTab: true,
        domains: [
            'www.facebook.com',
            'twitter.com',
            'www.reddit.com',
            'www.instagram.com'
        ]
    });

    await Settings.Save();

    TrackedDomains = ConstructTrackedDomains(Settings);

    console.log('----- STATUS: Installed');
});

// Startup
chrome.runtime.onStartup.addListener(() => {
    // Load URLs from storage
    chrome.storage.sync.get('settings', items => {
        Settings.Update(items['settings']);
        TrackedDomains = ConstructTrackedDomains(Settings);

        console.log('----- STATUS: Started')
    });
});

// Settings changes
chrome.storage.onChanged.addListener((changes, areaName) => {
    // This block updates settings
    console.log('-------- Settings changed')
    if (changes.hasOwnProperty('settings')) {
        // Get the new settings values
        Settings.Update(changes['settings'].newValue || changes['settings'].oldValue);

        // Update the tracking info
        // Delete removed domains
        for (const domain in TrackedDomains)
            if (TrackedDomains.hasOwnProperty(domain) && Settings.HasDomain(domain) === false)
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
    if (Settings.HasDomain(domain) === true)
        StartTracking(activeInfo.tabId, domain);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') return;

    console.log('--- onUpdated');
    let domain = await getDomainFromTabIdAsync(tabId);

    // Only track if domain is in settings list
    if (Settings.HasDomain(domain) === true)
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
    let tabs = await chrome.tabs.queryAsync({
        active: true,
        windowId: windowId
    });

    let tabId = tabs[0].id;

    // We're tracking active tab
    if (Settings.onlyTrackActiveTab === true) {
        StopTracking(PreviousTrackedTab.Id);

        // Tracking active tab and the focus is still on a Chrome window
        if (windowId !== chrome.windows.WINDOW_ID_NONE) {
            let domain = await getDomainFromTabIdAsync(tabId);
            if (Settings.HasDomain(domain) === true)
                StartTracking(tabId, domain);
        }
    }
});