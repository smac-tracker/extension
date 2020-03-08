$(document).ready(() => {
    ko.applyBindings(new PopupVm());
});

function PopupVm() {
    var self = this;

    self.Text = ko.observable('text');
}