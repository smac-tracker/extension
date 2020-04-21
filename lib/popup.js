var background;
var vm = new PopupVm();

// Event Listeners
// Update PopupVm settings
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (changes.hasOwnProperty('settings') === true)
        vm.Settings(ko.mapping.fromJS(background.Settings));
});

// Update PopupVm currentDomain
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Only care if the tab's url changed
    if (changeInfo.hasOwnProperty('url') === false)
        return;

    let currentWindow = await background.chrome.windows.getCurrentAsync();
    // Only care about current tab within the current window
    if (tab.active !== true || tab.windowId !== currentWindow.id)
        return;

    let domain = background.getDomainFromUrl(changeInfo.url);
    vm.CurrentDomain(domain);
});

// Apply Bindings / Setup
$(document).ready(async () => {
    background = await chrome.runtime.getBackgroundPageAsync();

    vm.Settings(background.Settings);
    vm.CurrentDomain(await getCurrentTabDomain());

    ko.applyBindings(vm);
});

chrome.runtime.getBackgroundPageAsync = () => new Promise(resolve => {
    chrome.runtime.getBackgroundPage(backgroundPage => {
        resolve(backgroundPage);
    });
});

chrome.windows.getLastFocusedAsync = getInfo => new Promise(resolve => {
    chrome.windows.getLastFocused(getInfo, window => {
        resolve(window);
    });
});

chrome.windows.getAllAsync = getInfo => new Promise(resolve => {
    chrome.windows.getAll(getInfo, window => {
        resolve(window);
    });
});

async function getCurrentTabDomain() {
    let tabs = await background.chrome.tabs.queryAsync({
        active: true,
        currentWindow: true
    });

    return await background.getDomainFromTabIdAsync(tabs[0].id);
}

function PopupVm() {
    var self = this;

    self.Text = ko.observable();
    self.Settings = ko.observable();
    self.CurrentDomain = ko.observable();

    self.AddThisSiteIsDisabled = ko.pureComputed(() => {
        return self.Settings().HasDomain(self.CurrentDomain());
    });

    // ----------- Functions ----------- //
    self.AddThisSite = async () => {
        // We already have this domain
        if(self.AddThisSiteIsDisabled() === true) return;
        
        // Otherwise add it to settings
        let added = self.Settings().AddDomain(await getCurrentTabDomain());
        self.Settings().Save();
        self.Text('Added: ' + added);
    };
}