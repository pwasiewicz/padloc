import { until } from "lit-html/directives/until";
import { Invite } from "@padloc/core/lib/invite.js";
import { localize as $l } from "@padloc/core/lib/locale.js";
import { formatDateFromNow } from "../util.js";
import { shared } from "../styles";
import { app } from "../init";
import { dialog } from "../dialog";
import { BaseElement, element, html, css, property, query } from "./base.js";
import { LoadingButton } from "./loading-button";
import { MemberDialog } from "./member-dialog.js";
import "./icon.js";

@element("pl-invite-item")
export class InviteItem extends BaseElement {
    @property()
    invite: Invite;

    @query(".confirm-button")
    private _confirmButton: LoadingButton;

    @dialog("pl-member-dialog")
    private _memberDialog: MemberDialog;

    private async _confirm() {
        if (this._confirmButton.state === "loading") {
            return;
        }
        this._confirmButton.start();
        try {
            const member = await app.confirmInvite(this.invite!);
            this._confirmButton.success();
            await this._memberDialog.show({ org: app.getOrg(this.invite!.org!.id)!, member });
        } catch (e) {
            this._confirmButton.fail();
            throw e;
        }
    }

    shoudUpdate() {
        return !!this.invite;
    }

    static styles = [
        shared,
        css`
            :host {
                display: flex;
                align-items: center;
                padding: 4px 0;
            }

            .icon {
                font-size: 120%;
                margin: 10px;
                background: #eee;
                border: solid 1px #ddd;
                width: 45px;
                height: 45px;
            }

            .tags {
                margin: 4px 0;
            }

            .invite-info {
                flex: 1;
                width: 0;
            }

            .invite:hover {
                background: #fafafa;
            }

            .invite .tags {
                padding: 0;
                margin: 0;
            }

            .invite-email {
                font-weight: bold;
                margin-bottom: 4px;
            }

            .invite-code {
                text-align: center;
                margin-right: 15px;
            }

            .invite-code-label {
                font-weight: bold;
                font-size: var(--font-size-micro);
            }

            .invite-code-value {
                font-size: 140%;
                font-family: var(--font-family-mono);
                font-weight: bold;
                text-transform: uppercase;
                cursor: text;
                user-select: text;
                letter-spacing: 2px;
            }

            .confirm-button {
                padding: 6px 8px;
                margin-right: 16px;
                font-size: var(--font-size-small);
                align-self: center;
            }
        `
    ];

    render() {
        const inv = this.invite!;
        const account = app.account!;
        const org = app.getOrg(inv.org.id)!;

        const status = inv.expired
            ? { icon: "time", class: "warning", text: $l("expired") }
            : inv.accepted
            ? { icon: "check", class: "highlight", text: $l("accepted") }
            : {
                  icon: "time",
                  class: "",
                  text: (async () => $l("expires {0}", await formatDateFromNow(inv.expires)))()
              };

        let secret = Promise.resolve("");

        if (org.isAdmin(account)) {
            const unlockOrg = org.unlock(account);
            secret = (async () => {
                await unlockOrg;
                await inv.unlock(org.invitesKey);
                return inv.secret;
            })();
        }

        return html`
            <pl-icon class="icon" icon="mail"></pl-icon>

            <div class="invite-info">
                <div class="invite-email ellipsis">${inv.email}</div>

                <div class="tags small">
                    <div class="tag ${status.class}">
                        <pl-icon icon="${status.icon}"></pl-icon>

                        <div>${until(status.text)}</div>
                    </div>
                </div>
            </div>

            <pl-loading-button class="tap primary confirm-button" ?hidden=${!inv.accepted} @click=${this._confirm}>
                ${$l("Confirm")}
            </pl-loading-button>

            <div class="invite-code" ?hidden=${inv.accepted}>
                <div class="invite-code-label">${$l("Confirmation Code:")}</div>

                <div class="invite-code-value">${until(secret)}</div>
            </div>
        `;
    }
}