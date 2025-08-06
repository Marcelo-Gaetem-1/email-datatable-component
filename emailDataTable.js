import { LightningElement, api, wire, track } from 'lwc';
import { CurrentPageReference }              from 'lightning/navigation';
import { refreshApex }                       from '@salesforce/apex';
import getEmails                             from '@salesforce/apex/EmailDataTableController.getEmails';

const COLUMNS = [
    { label: 'Asunto', fieldName: 'subject' },
    { label: 'De',     fieldName: 'from'    },
    { label: 'Para',   fieldName: 'to'      },
    {
        label: 'Fecha',
        fieldName: 'date',
        type: 'date',
        typeAttributes: {
            year: 'numeric', month: 'short', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        }
    },
    {
        type: 'button-icon',
        fixedWidth: 40,
        typeAttributes: {
            iconName : 'utility:preview',
            name     : 'view',
            title    : 'Ver correo',
            variant  : 'border-filled',
            alternativeText: 'Ver'
        }
    }
];

export default class EmailDataTable extends LightningElement {
    @api recordId;

    @wire(CurrentPageReference)
    parseState(pageRef) {
        if (!this.recordId && pageRef?.state?.recordId) {
            this.recordId = pageRef.state.recordId;
        }
        if (!this.recordId) {
            const m = window.location.pathname.match(/\/([a-zA-Z0-9]{15,18})(?:\/|$)/);
            if (m) this.recordId = m[1];
        }
    }

    @track emails        = [];
    @track selectedEmail = {};
    @track showModal     = false;
    @track isLoading     = true;
    @track error;

    columns     = COLUMNS;
    wiredResult = undefined;

    get caseIdForWire() {
        return this.recordId && this.recordId.startsWith('500') ? this.recordId : null;
    }
    get isCase() { return !!this.caseIdForWire; }

    get toggleIcon() {
        return this.collapsed ? 'utility:chevrondown' : 'utility:chevronup';
    }

    @wire(getEmails, { caseId: '$caseIdForWire' })
    wiredEmails(value) {
        this.wiredResult = value;
        const { data, error } = value;

        if (data) {
            this.emails = data.map(e => ({
                id:      e.id,
                subject: e.subject,
                from:    e.fromAddr,
                to:      e.toAddr,
                date:    e.sentDate,
                body:    this.trimHistory(e.body)
            }));
            this.error = undefined;
        } else if (error) {
            this.error = error;
            console.error('getEmails error:', error);
        }
        this.isLoading = false;
    }

    trimHistory(html) {
        if (!html) return '';
        html = html.replace(
            /(?:<br\s*\/?>\s*)?ref:[^:<>\s]+(?::[^:<>\s]+)*:ref(?:\s*<br\s*\/?>)?/gi,
            ''
        );
        const cutRegex = /-----\s*Original Message\s*-----|Mensaje original|<div[^>]*gmail_quote[^>]*>|<div[^>]*divRplyFwdMsg[^>]*>|<blockquote\b|<br[^>]*>\s*(?:From:|De:)|\n\s*(?:From:|De:)/i;
        const pos = html.search(cutRegex);
        return pos > 0 ? html.substring(0, pos) : html;
    }

    handleRowAction(event) {
        if (event.detail.action.name === 'view') {
            const row = event.detail.row;
            this.selectedEmail = {
                subject: row.subject,
                to:      row.to,
                date:    row.date,
                body:    row.body
            };
            this.showModal = true;
        }
    }
    closeModal() {
        this.showModal     = false;
        this.selectedEmail = {};
    }

    @track collapsed = true;
    get visibleRows() { return this.collapsed ? this.emails.slice(0, 5) : this.emails; }
    get hasMore()    { return this.emails.length > 5; }
    get toggleLabel(){ return this.collapsed ? 'Ver más' : 'Ver menos'; }
    toggleRows()     { this.collapsed = !this.collapsed; }

    handleRefresh() { this.doRefresh(); }
    refresh()       { this.doRefresh(); }
    doRefresh() {
        if (!this.wiredResult) return;
        this.isLoading = true;
        refreshApex(this.wiredResult).finally(() => { this.isLoading = false; });
    }

    get showEmpty() {
        return this.isCase && !this.isLoading && !this.error && this.emails.length === 0;
    }
}