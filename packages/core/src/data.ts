import { DateString, Marshalable } from "./encoding";
import { PrivateKey, Container, EncryptionScheme } from "./crypto";
import { Storable } from "./storage";
import { Account, PublicAccount } from "./auth";
import { uuid } from "./util";

export type StoreID = string;
export type RecordID = string;
export type Tag = string;

export interface Field {
    name: string;
    value: string;
    masked?: boolean;
}

export function normalizeTag(tag: string): Tag {
    return tag.replace(",", "");
}

export interface Record {
    id: RecordID;
    removed: boolean;
    name: string;
    fields: Field[];
    tags: Tag[];
    updated: Date;
    lastUsed?: Date;
}

export function createRecord(name: string, fields?: Field[], tags?: Tag[]) {
    return {
        id: uuid(),
        name: name,
        fields: fields || [],
        tags: tags || [],
        updated: new Date(),
        lastUsed: new Date(),
        removed: false
    };
}

export class Store implements Storable {
    id: string;
    created: DateString;
    updated: DateString;
    protected container: Container;
    private _records = new Map<string, Record>();
    storageKind = "store";

    get storageKey() {
        return this.id;
    }

    protected get scheme(): EncryptionScheme {
        return "simple";
    }

    constructor(id = "", records: Record[] = []) {
        this.id = id;
        this.container = new Container(this.scheme);
        this.addRecords(records);
    }

    get records(): Array<Record> {
        return Array.from(this._records.values());
    }

    get tags(): string[] {
        const tags = new Set<string>();
        for (const r of this.records) {
            for (const t of r.tags) {
                tags.add(t);
            }
        }
        return [...tags];
    }

    addRecords(rec: Record | Array<Record>) {
        const records = Array.isArray(rec) ? rec : [rec];
        for (const r of records) {
            const existing = this._records.get(r.id);
            if (!existing || r.updated > existing.updated) {
                this._records.set(r.id, r);
            }
        }
    }

    removeRecords(rec: Record | Record[]) {
        const records = Array.isArray(rec) ? rec : [rec];
        for (const r of records) {
            r.name = "";
            r.fields = [];
            r.tags = [];
            r.removed = true;
            r.updated = new Date();
        }
    }

    createRecord(name: string, fields?: Field[], tags?: Tag[]): Record {
        return createRecord(name, fields, tags);
    }

    protected async _serialize() {
        return {
            created: this.created,
            updated: this.updated,
            records: this.records.map((r: any) => {
                // For backwards compatibility
                r.uuid = r.id;
                return r;
            })
        };
    }

    protected async _deserialize(raw: any) {
        this.created = raw.created;
        this.updated = raw.updated;
        const records = raw.records.map((r: any) => {
            return {
                tags: r.tags || (r.category && [r.category]) || [],
                name: r.name,
                fields: r.fields,
                id: r.id || r.uuid || uuid(),
                removed: r.removed,
                updated: raw.updated ? new Date(raw.updated) : new Date(),
                lastUsed: raw.lastUsed && new Date(raw.lastUsed)
            } as Record;
        });
        this.addRecords(records);
        return this;
    }

    get serializer(): Storable {
        return {
            storageKey: this.storageKey,
            storageKind: this.storageKind,
            serialize: async () => this._serialize(),
            deserialize: async (raw: any) => this._deserialize(raw)
        };
    }

    protected prepContainer() {}

    async serialize(): Promise<Marshalable> {
        this.prepContainer();
        await this.container.set(this.serializer);
        return this.container.serialize();
    }

    async deserialize(raw: any) {
        this.prepContainer();
        await this.container.deserialize(raw);
        await this.container.get(this.serializer);
        this.id = this.container.id;
        return this;
    }

    async clear() {
        this._records = new Map<string, Record>();
        await this.container.clear();
    }
}

export class MainStore extends Store {
    privateKey: PrivateKey;
    trustedAccounts: PublicAccount[];

    get storageKey() {
        return "main";
    }

    protected get scheme(): EncryptionScheme {
        return "PBES2";
    }

    set password(pwd: string | undefined) {
        this.container.password = pwd;
    }

    get password(): string | undefined {
        return this.container.password;
    }

    protected async _serialize() {
        return Object.assign(await super._serialize(), {
            privateKey: this.privateKey,
            trustedAccounts: this.trustedAccounts
        });
    }

    protected async _deserialize(raw: any) {
        this.privateKey = raw.privateKey;
        this.trustedAccounts = raw.trustedAccounts;
        return super._deserialize(raw);
    }

    async clear() {
        await super.clear();
        delete this.privateKey;
        delete this.trustedAccounts;
    }
}

export class SharedStore extends Store {
    static create(): SharedStore {
        const store = new SharedStore(uuid());
        store.created = new Date().toISOString();
        store.updated = new Date().toISOString();
        return store;
    }

    constructor(public id: string) {
        super();
    }

    protected get scheme(): EncryptionScheme {
        return "shared";
    }
    members: PublicAccount[] = [];

    protected async _serialize() {
        return Object.assign(await super._serialize(), {
            members: this.members
        });
    }

    async addMember(member: Account) {
        this.members.push(member);
        this.prepContainer();
        await this.container.addParticipant(member);
    }
}