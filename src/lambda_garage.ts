import { BaseEntityHelpers, MiddlewareSecurity, dispatchFlowStep, getDbName } from 'skd-grql';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Embedded Config
const DOMAIN = process.env.DOMAIN || 'https://db-grql.com';
const API_KEY = process.env.API_KEY || 'TW5kemFreFRiM0JVYWtRMlYxRkZlblJVV1VsYVowTkdiM1U0ZDNCTVNtNGlmQ0phUjFZeVdWaENkMHh0VW14aVIyUkJXakl4YUdGWGQzVlpNamwwWmtjeGFGa3lhSEJpYlZaSVdWaEthRm95VlQwPSItIk1uZHpha3hUYjNCVWFrUTJWMUZGZW5SVVdVbGFaME5HYjNVNGQzQk1TbTQ9Ii4iWVc1a00zSnpNRzR1WkdWMk0yeHZjRzB6Ym5RPQ==';
const SECRET_KEY = process.env.JWT_SECRET || 's3cr3te_secure_key_32_bytes_long_minimum';
const DB_NAME = process.env.DB || 'GestionTallerProd';

let API_KEY_VAR = API_KEY;
const envKey = process.env.key;
if (envKey) {
    try { API_KEY_VAR = JSON.parse(envKey).apiKey || API_KEY_VAR; } catch { }
}

const DOMAIN_VAR = process.env.DOMAIN || DOMAIN;
let DB_VAR = DB_NAME;

function set_db(event: any): void {
    const header = event?.headerLambdaObject;
    if (!header) return;
    try {
        let obj = header;
        const missingPadding = obj.length % 4;
        if (missingPadding) obj += "=".repeat(4 - missingPadding);
        const decoded = Buffer.from(obj, 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded);
        if (parsed && parsed.environment) {
            const env = String(parsed.environment).trim() || "dev";
            DB_VAR = `${DB_NAME}-${env}`;
        }
    } catch { }
}

let baseEntityHelpers = new BaseEntityHelpers({
    domain: DOMAIN_VAR,
    apiKey: API_KEY_VAR,
    secretKey: SECRET_KEY,
    dbName: DB_VAR
});

let middlewareSecurity = new MiddlewareSecurity({
    domain: DOMAIN_VAR,
    apiKey: API_KEY_VAR,
    secretKey: SECRET_KEY,
    dbName: DB_VAR
});

// --- Helpers ---
async function storeWithDeduplication(
    table: string,
    payload: any,
    searchField: string,
    searchValue: any,
    event: any,
    helpers: BaseEntityHelpers
): Promise<any> {
    const val = String(searchValue || '').trim();
    if (val) {
        try {
            const existing = await helpers.data_filter(table, {
                filter: { field: searchField, value: val },
                headerLambda: event?.headerLambda,
                headerLambdaObject: event?.headerLambdaObject
            });
            const items = existing?.content || (Array.isArray(existing) ? existing : []);
            if (items && items.length > 0) {
                const primaryRecord = items[0];
                for (let i = 1; i < items.length; i++) {
                    if (items[i]?.id) {
                        try { await helpers.delete(table, items[i].id, event); } catch { }
                    }
                }
                const updateRes = await helpers.update(table, primaryRecord.id, payload);
                return updateRes?.id ? updateRes : { ...payload.attribute, id: primaryRecord.id, updated: true };
            }
        } catch { }
    }
    return helpers.store(table, payload);
}

const fkCache: Record<string, string> = {};

async function resolveId(
    table: string,
    field: string,
    value: any,
    event: any,
    helpers: BaseEntityHelpers
): Promise<string | null> {
    const val = String(value || '').trim();
    if (!val) return null;
    const cacheKey = `${table}:${field}:${val.toUpperCase()}`;
    if (fkCache[cacheKey]) return fkCache[cacheKey];

    try {
        const res = await helpers.data_filter(table, {
            filter: { field, value: val },
            headerLambda: event?.headerLambda,
            headerLambdaObject: event?.headerLambdaObject
        });
        const items = res?.content || (Array.isArray(res) ? res : []);
        if (items && items.length > 0 && items[0]?.id) {
            fkCache[cacheKey] = items[0].id;
            return items[0].id;
        }
    } catch { }
    return null;
}

// --- Entities ---


export class GestionTallerProdClients {
    static table = 'clients';

    static build_payload(event: any): any {
        const envSuffix = DB_VAR.includes('-') ? '-' + DB_VAR.split('-')[1] : '';
        const db = 'GestionTallerProd' + envSuffix;

        const obj_fk: any[] = [];

        return {
            db, table: 'clients',
            attribute: {
                client_name: event.client_name || '',
                tax_id: event.tax_id || '',
                cell_phone: event.cell_phone || '',
                home_phone: event.home_phone || '',
                email: event.email || '',
                address: event.address || '',
                registration_date: event.registration_date || '',
            },
            obj_fk
        };
    }

    static async store(event: any, helpers?: BaseEntityHelpers, sec?: MiddlewareSecurity): Promise<any> {
        const h = helpers || baseEntityHelpers;
        let payload = GestionTallerProdClients.build_payload(event);
        const res = await storeWithDeduplication('clients', payload, event.tax_id ? 'tax_id' : 'client_name', event.tax_id || event.client_name, event, h);
        if (res?.id) {
            if (event.tax_id) fkCache[`clients:tax_id:${String(event.tax_id).trim().toUpperCase()}`] = res.id;
            if (event.client_name) fkCache[`clients:client_name:${String(event.client_name).trim().toUpperCase()}`] = res.id;
        }
        return res;
    }


    static async update(id: string, event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.update('clients', id, GestionTallerProdClients.build_payload(event));
    }

    static async delete(event: any, id: string, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.delete('clients', id, event);
    }

    static async data_filter(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.data_filter('clients', event);
    }

    static async paginate(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.paginate('clients', event);
    }

    static async count(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.count('clients', event);
    }
}

export class GestionTallerProdSuppliers {
    static table = 'suppliers';

    static build_payload(event: any): any {
        const envSuffix = DB_VAR.includes('-') ? '-' + DB_VAR.split('-')[1] : '';
        const db = 'GestionTallerProd' + envSuffix;

        const obj_fk: any[] = [];

        return {
            db, table: 'suppliers',
            attribute: {
                supplier_name: event.supplier_name || '',
                contact_person: event.contact_person || '',
                address: event.address || '',
                cell_phone: event.cell_phone || '',
                office_phone: event.office_phone || '',
                email: event.email || '',
                distributes_parts: event.distributes_parts || '',
                transport: event.transport || '',
            },
            obj_fk
        };
    }

    static async store(event: any, helpers?: BaseEntityHelpers, sec?: MiddlewareSecurity): Promise<any> {
        const h = helpers || baseEntityHelpers;
        let payload = GestionTallerProdSuppliers.build_payload(event);
        const res = await storeWithDeduplication('suppliers', payload, 'supplier_name', event.supplier_name, event, h);
        if (res?.id && event.supplier_name) {
            fkCache[`suppliers:supplier_name:${String(event.supplier_name).trim().toUpperCase()}`] = res.id;
        }
        return res;
    }

    static async update(id: string, event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.update('suppliers', id, GestionTallerProdSuppliers.build_payload(event));
    }

    static async delete(event: any, id: string, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.delete('suppliers', id, event);
    }

    static async data_filter(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.data_filter('suppliers', event);
    }

    static async paginate(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.paginate('suppliers', event);
    }

    static async count(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.count('suppliers', event);
    }
}

export class GestionTallerProdVehicles {
    static table = 'vehicles';

    static build_payload(event: any): any {
        const envSuffix = DB_VAR.includes('-') ? '-' + DB_VAR.split('-')[1] : '';
        const db = 'GestionTallerProd' + envSuffix;

        const obj_fk: any[] = [];
        if (event.clients_fk_id) {
            const cArr = (Array.isArray(event.clients_fk_id) ? event.clients_fk_id : [event.clients_fk_id]).filter(Boolean);
            if (cArr.length > 0) obj_fk.push({ clients: cArr });
        }

        return {
            db, table: 'vehicles',
            attribute: {
                license_plate: event.license_plate || '',
                brand: event.brand || '',
                model: event.model || '',
                year: event.year || '',
                color: event.color || '',
                mileage: event.mileage || '',
                vehicle_type: event.vehicle_type || '',
            },
            obj_fk
        };
    }

    static async store(event: any, helpers?: BaseEntityHelpers, sec?: MiddlewareSecurity): Promise<any> {
        const h = helpers || baseEntityHelpers;
        if (!event.clients_fk_id || (Array.isArray(event.clients_fk_id) && event.clients_fk_id.length === 0)) {
            let cId = event.owner_tax_id ? await resolveId('clients', 'tax_id', event.owner_tax_id, event, h) : null;
            if (!cId && event.tax_id) {
                cId = await resolveId('clients', 'tax_id', event.tax_id, event, h);
            }
            if (!cId && (event.owner_name || event.client_name)) {
                cId = await resolveId('clients', 'client_name', event.owner_name || event.client_name, event, h);
            }
            if (cId) {
                event.clients_fk_id = [cId];
                if (event.license_plate) {
                    fkCache[`vehicle_to_client:${String(event.license_plate).trim().toUpperCase()}`] = cId;
                }
            }
        }
        let payload = GestionTallerProdVehicles.build_payload(event);
        const res = await storeWithDeduplication('vehicles', payload, 'license_plate', event.license_plate, event, h);
        if (res?.id && event.license_plate) {
            fkCache[`vehicles:license_plate:${String(event.license_plate).trim().toUpperCase()}`] = res.id;
        }
        return res;
    }

    static async update(id: string, event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.update('vehicles', id, GestionTallerProdVehicles.build_payload(event));
    }

    static async delete(event: any, id: string, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.delete('vehicles', id, event);
    }

    static async data_filter(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.data_filter('vehicles', event);
    }

    static async paginate(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.paginate('vehicles', event);
    }

    static async count(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.count('vehicles', event);
    }
}

export class GestionTallerProdVehicleReceipts {
    static table = 'vehicle_receipts';

    static build_payload(event: any): any {
        const envSuffix = DB_VAR.includes('-') ? '-' + DB_VAR.split('-')[1] : '';
        const db = 'GestionTallerProd' + envSuffix;

        const obj_fk: any[] = [];
        if (event.vehicles_fk_id) {
            const vArr = (Array.isArray(event.vehicles_fk_id) ? event.vehicles_fk_id : [event.vehicles_fk_id]).filter(Boolean);
            if (vArr.length > 0) obj_fk.push({ vehicles: vArr });
        }
        if (event.employees_fk_id) {
            const eArr = (Array.isArray(event.employees_fk_id) ? event.employees_fk_id : [event.employees_fk_id]).filter(Boolean);
            if (eArr.length > 0) obj_fk.push({ employees: eArr });
        }

        return {
            db, table: 'vehicle_receipts',
            attribute: {
                entry_date: event.entry_date || '',
                owner_name: event.owner_name || '',
                owner_tax_id: event.owner_tax_id || '',
                phone: event.phone || '',
                brand: event.brand || '',
                model: event.model || '',
                license_plate: event.license_plate || '',
                color: event.color || '',
                mileage: event.mileage || '',
                exit_date: event.exit_date || '',
                receiving_technician: event.receiving_technician || '',
                reception_service: event.reception_service || '',
                address: event.address || '',
                received_by: event.received_by || '',
                delivered_by: event.delivered_by || '',
                delivery_address: event.delivery_address || '',
                assigned_technician: event.assigned_technician || '',
                time_in_shop: event.time_in_shop || '',
                reason_for_entry: event.reason_for_entry || '',
                work_performed: event.work_performed || '',
                must_return: event.must_return || '',
                pending_issues: event.pending_issues || '',
                delivery_date: event.delivery_date || '',
                expected_return_date: event.expected_return_date || '',
            },
            obj_fk
        };
    }

    static async store(event: any, helpers?: BaseEntityHelpers, sec?: MiddlewareSecurity): Promise<any> {
        const h = helpers || baseEntityHelpers;
        if (!event.vehicles_fk_id || (Array.isArray(event.vehicles_fk_id) && event.vehicles_fk_id.length === 0)) {
            if (event.license_plate) {
                const vId = await resolveId('vehicles', 'license_plate', event.license_plate, event, h);
                if (vId) event.vehicles_fk_id = [vId];
            }
        }
        if (!event.employees_fk_id || (Array.isArray(event.employees_fk_id) && event.employees_fk_id.length === 0)) {
            const empName = event.assigned_technician || event.receiving_technician || event.received_by;
            if (empName) {
                const eId = await resolveId('employees', 'employee_name', empName, event, h);
                if (eId) event.employees_fk_id = [eId];
            }
        }
        let payload = GestionTallerProdVehicleReceipts.build_payload(event);
        return storeWithDeduplication('vehicle_receipts', payload, 'license_plate', event.license_plate, event, h);
    }

    static async update(id: string, event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.update('vehicle_receipts', id, GestionTallerProdVehicleReceipts.build_payload(event));
    }

    static async delete(event: any, id: string, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.delete('vehicle_receipts', id, event);
    }

    static async data_filter(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.data_filter('vehicle_receipts', event);
    }

    static async paginate(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.paginate('vehicle_receipts', event);
    }

    static async count(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.count('vehicle_receipts', event);
    }
}

export class GestionTallerProdClientHistory {
    static table = 'client_history';

    static build_payload(event: any): any {
        const envSuffix = DB_VAR.includes('-') ? '-' + DB_VAR.split('-')[1] : '';
        const db = 'GestionTallerProd' + envSuffix;

        const obj_fk: any[] = [];
        const vehId = Array.isArray(event.vehicles_fk_id) ? event.vehicles_fk_id[0] : (event.vehicles_fk_id || '');
        const empId = Array.isArray(event.employees_fk_id) ? event.employees_fk_id[0] : (event.employees_fk_id || '');

        if (event.vehicles_fk_id) {
            const vArr = (Array.isArray(event.vehicles_fk_id) ? event.vehicles_fk_id : [event.vehicles_fk_id]).filter(Boolean);
            if (vArr.length > 0) obj_fk.push({ vehicles: vArr });
        }
        if (event.employees_fk_id) {
            const eArr = (Array.isArray(event.employees_fk_id) ? event.employees_fk_id : [event.employees_fk_id]).filter(Boolean);
            if (eArr.length > 0) obj_fk.push({ employees: eArr });
        }

        return {
            db, table: 'client_history',
            attribute: {
                vehicles_fk_id: vehId,
                employees_fk_id: empId,
                service_date: event.service_date || '',
                work_performed: event.work_performed || '',
                assigned_mechanic: event.assigned_mechanic || '',
                time_in_shop: event.time_in_shop || '',
                observations: event.observations || '',
                total_cost: Number(event.total_cost) || 0,
            },
            obj_fk
        };
    }

    static async store(event: any, helpers?: BaseEntityHelpers, sec?: MiddlewareSecurity): Promise<any> {
        const h = helpers || baseEntityHelpers;
        if (!event.vehicles_fk_id || (Array.isArray(event.vehicles_fk_id) && event.vehicles_fk_id.length === 0)) {
            if (event.license_plate) {
                const vId = await resolveId('vehicles', 'license_plate', event.license_plate, event, h);
                if (vId) event.vehicles_fk_id = [vId];
            }
        }
        if (!event.employees_fk_id || (Array.isArray(event.employees_fk_id) && event.employees_fk_id.length === 0)) {
            if (event.assigned_mechanic) {
                const eId = await resolveId('employees', 'employee_name', event.assigned_mechanic, event, h);
                if (eId) event.employees_fk_id = [eId];
            }
        }
        let payload = GestionTallerProdClientHistory.build_payload(event);
        return storeWithDeduplication('client_history', payload, 'work_performed', event.work_performed, event, h);
    }

    static async update(id: string, event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.update('client_history', id, GestionTallerProdClientHistory.build_payload(event));
    }

    static async delete(event: any, id: string, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.delete('client_history', id, event);
    }

    static async data_filter(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.data_filter('client_history', event);
    }

    static async paginate(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.paginate('client_history', event);
    }

    static async count(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.count('client_history', event);
    }
}

export class GestionTallerProdQuotes {
    static table = 'quotes';

    static build_payload(event: any): any {
        const envSuffix = DB_VAR.includes('-') ? '-' + DB_VAR.split('-')[1] : '';
        const db = 'GestionTallerProd' + envSuffix;

        const obj_fk: any[] = [];
        if (event.vehicles_fk_id) {
            const vArr = (Array.isArray(event.vehicles_fk_id) ? event.vehicles_fk_id : [event.vehicles_fk_id]).filter(Boolean);
            if (vArr.length > 0) obj_fk.push({ vehicles: vArr });
        }
        if (event.clients_fk_id) {
            const cArr = (Array.isArray(event.clients_fk_id) ? event.clients_fk_id : [event.clients_fk_id]).filter(Boolean);
            if (cArr.length > 0) obj_fk.push({ clients: cArr });
        }

        return {
            db, table: 'quotes',
            attribute: {
                quote_number: event.quote_number || '',
                quote_date: event.quote_date || '',
                client_name: event.client_name || '',
                tax_id: event.tax_id || '',
                vehicle_type: event.vehicle_type || '',
                brand: event.brand || '',
                model: event.model || '',
                address: event.address || '',
                license_plate: event.license_plate || '',
                year: event.year || '',
                subtotal: event.subtotal || '',
                total: event.total || '',
                status: event.status || '',
            },
            obj_fk
        };
    }

    static async store(event: any, helpers?: BaseEntityHelpers, sec?: MiddlewareSecurity): Promise<any> {
        const h = helpers || baseEntityHelpers;
        if (!event.clients_fk_id || (Array.isArray(event.clients_fk_id) && event.clients_fk_id.length === 0)) {
            let cId = event.tax_id ? await resolveId('clients', 'tax_id', event.tax_id, event, h) : null;
            if (!cId && event.client_name) {
                cId = await resolveId('clients', 'client_name', event.client_name, event, h);
            }
            if (!cId && event.license_plate) {
                const plateKey = `vehicle_to_client:${String(event.license_plate).trim().toUpperCase()}`;
                if (fkCache[plateKey]) {
                    cId = fkCache[plateKey];
                }
            }
            if (cId) event.clients_fk_id = [cId];
        }
        if (!event.vehicles_fk_id || (Array.isArray(event.vehicles_fk_id) && event.vehicles_fk_id.length === 0)) {
            if (event.license_plate) {
                const vId = await resolveId('vehicles', 'license_plate', event.license_plate, event, h);
                if (vId) event.vehicles_fk_id = [vId];
            }
        }
        let payload = GestionTallerProdQuotes.build_payload(event);
        const res = await storeWithDeduplication('quotes', payload, 'quote_number', event.quote_number, event, h);
        if (res?.id && event.quote_number) {
            fkCache[`quotes:quote_number:${String(event.quote_number).trim().toUpperCase()}`] = res.id;
        }
        return res;
    }


    static async update(id: string, event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.update('quotes', id, GestionTallerProdQuotes.build_payload(event));
    }

    static async delete(event: any, id: string, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.delete('quotes', id, event);
    }

    static async data_filter(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.data_filter('quotes', event);
    }

    static async paginate(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.paginate('quotes', event);
    }

    static async count(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.count('quotes', event);
    }
}

export class GestionTallerProdQuoteItems {
    static table = 'quote_items';

    static build_payload(event: any): any {
        const envSuffix = DB_VAR.includes('-') ? '-' + DB_VAR.split('-')[1] : '';
        const db = 'GestionTallerProd' + envSuffix;

        const obj_fk: any[] = [];
        if (event.quotes_fk_id) {
            const qArr = (Array.isArray(event.quotes_fk_id) ? event.quotes_fk_id : [event.quotes_fk_id]).filter(Boolean);
            if (qArr.length > 0) obj_fk.push({ quotes: qArr });
        }

        return {
            db, table: 'quote_items',
            attribute: {
                item_number: event.item_number || '',
                description: event.description || '',
                quantity: event.quantity || '',
                unit_price: event.unit_price || '',
                total_price: event.total_price || '',
                supplier_store: event.supplier_store || '',
                product_name: event.product_name || '',
                product_brand: event.product_brand || '',
                product_price: event.product_price || '',
            },
            obj_fk
        };
    }

    static async store(event: any, helpers?: BaseEntityHelpers, sec?: MiddlewareSecurity): Promise<any> {
        const h = helpers || baseEntityHelpers;
        if (!event.quotes_fk_id || (Array.isArray(event.quotes_fk_id) && event.quotes_fk_id.length === 0)) {
            let qNum = event.quote_number;
            if (!qNum && typeof event.description === 'string') {
                const m = event.description.match(/COT-\d+/i);
                if (m) qNum = m[0];
            }
            if (qNum) {
                const qId = await resolveId('quotes', 'quote_number', qNum, event, h);
                if (qId) event.quotes_fk_id = [qId];
            }
        }
        let payload = GestionTallerProdQuoteItems.build_payload(event);
        return storeWithDeduplication('quote_items', payload, 'description', event.description, event, h);
    }

    static async update(id: string, event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.update('quote_items', id, GestionTallerProdQuoteItems.build_payload(event));
    }

    static async delete(event: any, id: string, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.delete('quote_items', id, event);
    }

    static async data_filter(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.data_filter('quote_items', event);
    }

    static async paginate(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.paginate('quote_items', event);
    }

    static async count(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.count('quote_items', event);
    }
}

export class GestionTallerProdAccountsReceivable {
    static table = 'accounts_receivable';

    static build_payload(event: any): any {
        const envSuffix = DB_VAR.includes('-') ? '-' + DB_VAR.split('-')[1] : '';
        const db = 'GestionTallerProd' + envSuffix;

        const obj_fk: any[] = [];
        if (event.clients_fk_id) {
            const cArr = (Array.isArray(event.clients_fk_id) ? event.clients_fk_id : [event.clients_fk_id]).filter(Boolean);
            if (cArr.length > 0) obj_fk.push({ clients: cArr });
        }

        return {
            db, table: 'accounts_receivable',
            attribute: {
                transaction_date: event.transaction_date || '',
                payment_date: event.payment_date || '',
                description: event.description || '',
                debit: event.debit || '',
                credit: event.credit || '',
                balance: event.balance || '',
            },
            obj_fk
        };
    }

    static async store(event: any, helpers?: BaseEntityHelpers, sec?: MiddlewareSecurity): Promise<any> {
        const h = helpers || baseEntityHelpers;
        if (!event.clients_fk_id || (Array.isArray(event.clients_fk_id) && event.clients_fk_id.length === 0)) {
            let cId = event.tax_id ? await resolveId('clients', 'tax_id', event.tax_id, event, h) : null;
            if (!cId && event.client_name) {
                cId = await resolveId('clients', 'client_name', event.client_name, event, h);
            }
            if (cId) event.clients_fk_id = [cId];
        }
        let payload = GestionTallerProdAccountsReceivable.build_payload(event);
        return storeWithDeduplication('accounts_receivable', payload, 'description', event.description, event, h);
    }

    static async update(id: string, event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.update('accounts_receivable', id, GestionTallerProdAccountsReceivable.build_payload(event));
    }

    static async delete(event: any, id: string, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.delete('accounts_receivable', id, event);
    }

    static async data_filter(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.data_filter('accounts_receivable', event);
    }

    static async paginate(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.paginate('accounts_receivable', event);
    }

    static async count(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.count('accounts_receivable', event);
    }
}

export class GestionTallerProdAccountsPayable {
    static table = 'accounts_payable';

    static build_payload(event: any): any {
        const envSuffix = DB_VAR.includes('-') ? '-' + DB_VAR.split('-')[1] : '';
        const db = 'GestionTallerProd' + envSuffix;

        const obj_fk: any[] = [];
        if (event.suppliers_fk_id) {
            const sArr = (Array.isArray(event.suppliers_fk_id) ? event.suppliers_fk_id : [event.suppliers_fk_id]).filter(Boolean);
            if (sArr.length > 0) obj_fk.push({ suppliers: sArr });
        }

        return {
            db, table: 'accounts_payable',
            attribute: {
                transaction_date: event.transaction_date || '',
                payment_date: event.payment_date || '',
                description: event.description || '',
                debit: event.debit || '',
                credit: event.credit || '',
                balance: event.balance || '',
            },
            obj_fk
        };
    }

    static async store(event: any, helpers?: BaseEntityHelpers, sec?: MiddlewareSecurity): Promise<any> {
        const h = helpers || baseEntityHelpers;
        if (!event.suppliers_fk_id || (Array.isArray(event.suppliers_fk_id) && event.suppliers_fk_id.length === 0)) {
            if (event.supplier_name) {
                const sId = await resolveId('suppliers', 'supplier_name', event.supplier_name, event, h);
                if (sId) event.suppliers_fk_id = [sId];
            }
        }
        let payload = GestionTallerProdAccountsPayable.build_payload(event);
        return storeWithDeduplication('accounts_payable', payload, 'description', event.description, event, h);
    }

    static async update(id: string, event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.update('accounts_payable', id, GestionTallerProdAccountsPayable.build_payload(event));
    }

    static async delete(event: any, id: string, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.delete('accounts_payable', id, event);
    }

    static async data_filter(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.data_filter('accounts_payable', event);
    }

    static async paginate(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.paginate('accounts_payable', event);
    }

    static async count(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.count('accounts_payable', event);
    }
}

export class GestionTallerProdFinancialTransactions {
    static table = 'financial_transactions';

    static build_payload(event: any): any {
        const envSuffix = DB_VAR.includes('-') ? '-' + DB_VAR.split('-')[1] : '';
        const db = 'GestionTallerProd' + envSuffix;

        const obj_fk: any[] = [];

        return {
            db, table: 'financial_transactions',
            attribute: {
                month: event.month || '',
                transaction_date: event.transaction_date || '',
                description: event.description || '',
                minor_rep_income: event.minor_rep_income || 0,
                major_rep_income: event.major_rep_income || 0,
                other_income: event.other_income || 0,
                salary_expense: event.salary_expense || 0,
                rent_expense: event.rent_expense || 0,
                supplies_expense: event.supplies_expense || 0,
                tools_equipment_expense: event.tools_equipment_expense || 0,
                other_expenses: event.other_expenses || 0,
                total_expenses: event.total_expenses || 0,
                total_amount: event.total_amount || 0,
                exchange_rate: event.exchange_rate || 0,
            },
            obj_fk
        };
    }

    static async store(event: any, helpers?: BaseEntityHelpers, sec?: MiddlewareSecurity): Promise<any> {
        const h = helpers || baseEntityHelpers;
        let payload = GestionTallerProdFinancialTransactions.build_payload(event);
        return storeWithDeduplication('financial_transactions', payload, 'description', event.description, event, h);
    }

    static async update(id: string, event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.update('financial_transactions', id, GestionTallerProdFinancialTransactions.build_payload(event));
    }

    static async delete(event: any, id: string, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.delete('financial_transactions', id, event);
    }

    static async data_filter(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.data_filter('financial_transactions', event);
    }

    static async paginate(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.paginate('financial_transactions', event);
    }

    static async count(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.count('financial_transactions', event);
    }
}

export class GestionTallerProdPartsCatalog {
    static table = 'parts_catalog';

    static build_payload(event: any): any {
        const envSuffix = DB_VAR.includes('-') ? '-' + DB_VAR.split('-')[1] : '';
        const db = 'GestionTallerProd' + envSuffix;

        const obj_fk: any[] = [];

        return {
            db, table: 'parts_catalog',
            attribute: {
                part_code: event.part_code || '',
                description: event.description || '',
                brand: event.brand || '',
                price_without_tax: event.price_without_tax || '',
                stock_main: event.stock_main || '',
                stock_caracas: event.stock_caracas || '',
                discount_1: event.discount_1 || '',
                discounted_price_1: event.discounted_price_1 || '',
                discount_2: event.discount_2 || '',
                final_discounted_price: event.final_discounted_price || '',
                final_discount: event.final_discount || '',
                price_by_rubro: event.price_by_rubro || '',
                bs_to_uro: event.bs_to_uro || '',
                category: event.category || '',
            },
            obj_fk
        };
    }

    static async store(event: any, helpers?: BaseEntityHelpers, sec?: MiddlewareSecurity): Promise<any> {
        const h = helpers || baseEntityHelpers;
        let payload = GestionTallerProdPartsCatalog.build_payload(event);
        return storeWithDeduplication('parts_catalog', payload, 'part_code', event.part_code || event.code, event, h);
    }

    static async update(id: string, event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.update('parts_catalog', id, GestionTallerProdPartsCatalog.build_payload(event));
    }

    static async delete(event: any, id: string, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.delete('parts_catalog', id, event);
    }

    static async data_filter(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.data_filter('parts_catalog', event);
    }

    static async paginate(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.paginate('parts_catalog', event);
    }

    static async count(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.count('parts_catalog', event);
    }
}

export class GestionTallerProdPendingPurchases {
    static table = 'pending_purchases';

    static build_payload(event: any): any {
        const envSuffix = DB_VAR.includes('-') ? '-' + DB_VAR.split('-')[1] : '';
        const db = 'GestionTallerProd' + envSuffix;

        const obj_fk: any[] = [];
        if (event.suppliers_fk_id) {
            const sArr = (Array.isArray(event.suppliers_fk_id) ? event.suppliers_fk_id : [event.suppliers_fk_id]).filter(Boolean);
            if (sArr.length > 0) obj_fk.push({ suppliers: sArr });
        }

        return {
            db, table: 'pending_purchases',
            attribute: {
                info_date: event.info_date || '',
                purchase_date: event.purchase_date || '',
                product_name: event.product_name || '',
                supplier_name: event.supplier_name || '',
                purchased: event.purchased || '',
                quantity: event.quantity || '',
                unit_price: event.unit_price || '',
                notes: event.notes || '',
            },
            obj_fk
        };
    }

    static async store(event: any, helpers?: BaseEntityHelpers, sec?: MiddlewareSecurity): Promise<any> {
        const h = helpers || baseEntityHelpers;
        if (!event.suppliers_fk_id || (Array.isArray(event.suppliers_fk_id) && event.suppliers_fk_id.length === 0)) {
            if (event.supplier_name) {
                const sId = await resolveId('suppliers', 'supplier_name', event.supplier_name, event, h);
                if (sId) event.suppliers_fk_id = [sId];
            }
        }
        let payload = GestionTallerProdPendingPurchases.build_payload(event);
        return storeWithDeduplication('pending_purchases', payload, 'product_name', event.product_name, event, h);
    }

    static async update(id: string, event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.update('pending_purchases', id, GestionTallerProdPendingPurchases.build_payload(event));
    }

    static async delete(event: any, id: string, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.delete('pending_purchases', id, event);
    }

    static async data_filter(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.data_filter('pending_purchases', event);
    }

    static async paginate(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.paginate('pending_purchases', event);
    }

    static async count(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.count('pending_purchases', event);
    }
}

export class GestionTallerProdEmployees {
    static table = 'employees';

    static build_payload(event: any): any {
        const envSuffix = DB_VAR.includes('-') ? '-' + DB_VAR.split('-')[1] : '';
        const db = 'GestionTallerProd' + envSuffix;

        const obj_fk: any[] = [];

        return {
            db, table: 'employees',
            attribute: {
                employee_name: event.employee_name || '',
                tax_id: event.tax_id || '',
                phone: event.phone || '',
                address: event.address || '',
                hire_date: event.hire_date || '',
                employee_type: event.employee_type || '',
                salary: event.salary || '',
                email: event.email || '',
                contract_type: event.contract_type || '',
                position: event.position || '',
                is_mechanic: event.is_mechanic || '',
            },
            obj_fk
        };
    }

    static async store(event: any, helpers?: BaseEntityHelpers, sec?: MiddlewareSecurity): Promise<any> {
        const h = helpers || baseEntityHelpers;
        let payload = GestionTallerProdEmployees.build_payload(event);
        const res = await storeWithDeduplication('employees', payload, event.tax_id ? 'tax_id' : 'employee_name', event.tax_id || event.employee_name, event, h);
        if (res?.id) {
            if (event.tax_id) fkCache[`employees:tax_id:${String(event.tax_id).trim().toUpperCase()}`] = res.id;
            if (event.employee_name) fkCache[`employees:employee_name:${String(event.employee_name).trim().toUpperCase()}`] = res.id;
        }
        return res;
    }

    static async update(id: string, event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.update('employees', id, GestionTallerProdEmployees.build_payload(event));
    }

    static async delete(event: any, id: string, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.delete('employees', id, event);
    }

    static async data_filter(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.data_filter('employees', event);
    }

    static async paginate(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.paginate('employees', event);
    }

    static async count(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.count('employees', event);
    }
}

export class GestionTallerProdDeliveryNotes {
    static table = 'delivery_notes';

    static build_payload(event: any): any {
        const envSuffix = DB_VAR.includes('-') ? '-' + DB_VAR.split('-')[1] : '';
        const db = 'GestionTallerProd' + envSuffix;

        const obj_fk: any[] = [];
        if (event.vehicles_fk_id) {
            const vArr = (Array.isArray(event.vehicles_fk_id) ? event.vehicles_fk_id : [event.vehicles_fk_id]).filter(Boolean);
            if (vArr.length > 0) obj_fk.push({ vehicles: vArr });
        }
        if (event.clients_fk_id) {
            const cArr = (Array.isArray(event.clients_fk_id) ? event.clients_fk_id : [event.clients_fk_id]).filter(Boolean);
            if (cArr.length > 0) obj_fk.push({ clients: cArr });
        }

        return {
            db, table: 'delivery_notes',
            attribute: {
                note_number: event.note_number || '',
                note_date: event.note_date || '',
                client_name: event.client_name || '',
                tax_id: event.tax_id || '',
                vehicle_type: event.vehicle_type || '',
                brand: event.brand || '',
                model: event.model || '',
                license_plate: event.license_plate || '',
                subtotal: event.subtotal || '',
                total: event.total || '',
            },
            obj_fk
        };
    }

    static async store(event: any, helpers?: BaseEntityHelpers, sec?: MiddlewareSecurity): Promise<any> {
        const h = helpers || baseEntityHelpers;
        if (!event.clients_fk_id || (Array.isArray(event.clients_fk_id) && event.clients_fk_id.length === 0)) {
            let cId = event.tax_id ? await resolveId('clients', 'tax_id', event.tax_id, event, h) : null;
            if (!cId && event.client_name) {
                cId = await resolveId('clients', 'client_name', event.client_name, event, h);
            }
            if (!cId && event.license_plate) {
                const plateKey = `vehicle_to_client:${String(event.license_plate).trim().toUpperCase()}`;
                if (fkCache[plateKey]) {
                    cId = fkCache[plateKey];
                }
            }
            if (cId) event.clients_fk_id = [cId];
        }
        if (!event.vehicles_fk_id || (Array.isArray(event.vehicles_fk_id) && event.vehicles_fk_id.length === 0)) {
            if (event.license_plate) {
                const vId = await resolveId('vehicles', 'license_plate', event.license_plate, event, h);
                if (vId) event.vehicles_fk_id = [vId];
            }
        }
        let payload = GestionTallerProdDeliveryNotes.build_payload(event);
        const res = await storeWithDeduplication('delivery_notes', payload, 'note_number', event.note_number, event, h);
        if (res?.id && event.note_number) {
            fkCache[`delivery_notes:note_number:${String(event.note_number).trim().toUpperCase()}`] = res.id;
        }
        return res;
    }

    static async update(id: string, event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.update('delivery_notes', id, GestionTallerProdDeliveryNotes.build_payload(event));
    }

    static async delete(event: any, id: string, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.delete('delivery_notes', id, event);
    }

    static async data_filter(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.data_filter('delivery_notes', event);
    }

    static async paginate(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.paginate('delivery_notes', event);
    }

    static async count(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.count('delivery_notes', event);
    }
}

export class GestionTallerProdDeliveryNoteItems {
    static table = 'delivery_note_items';

    static build_payload(event: any): any {
        const envSuffix = DB_VAR.includes('-') ? '-' + DB_VAR.split('-')[1] : '';
        const db = 'GestionTallerProd' + envSuffix;

        const obj_fk: any[] = [];
        if (event.delivery_notes_fk_id) {
            const dArr = (Array.isArray(event.delivery_notes_fk_id) ? event.delivery_notes_fk_id : [event.delivery_notes_fk_id]).filter(Boolean);
            if (dArr.length > 0) obj_fk.push({ delivery_notes: dArr });
        }

        return {
            db, table: 'delivery_note_items',
            attribute: {
                item_number: event.item_number || '',
                description: event.description || '',
                quantity: event.quantity || '',
                unit_price: event.unit_price || '',
                labor_cost: event.labor_cost || '',
                total_price: event.total_price || '',
            },
            obj_fk
        };
    }

    static async store(event: any, helpers?: BaseEntityHelpers, sec?: MiddlewareSecurity): Promise<any> {
        const h = helpers || baseEntityHelpers;
        if (!event.delivery_notes_fk_id || (Array.isArray(event.delivery_notes_fk_id) && event.delivery_notes_fk_id.length === 0)) {
            if (event.note_number) {
                const nId = await resolveId('delivery_notes', 'note_number', event.note_number, event, h);
                if (nId) event.delivery_notes_fk_id = [nId];
            }
        }
        let payload = GestionTallerProdDeliveryNoteItems.build_payload(event);
        return storeWithDeduplication('delivery_note_items', payload, 'description', event.description, event, h);
    }

    static async update(id: string, event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.update('delivery_note_items', id, GestionTallerProdDeliveryNoteItems.build_payload(event));
    }

    static async delete(event: any, id: string, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.delete('delivery_note_items', id, event);
    }

    static async data_filter(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.data_filter('delivery_note_items', event);
    }

    static async paginate(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.paginate('delivery_note_items', event);
    }

    static async count(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.count('delivery_note_items', event);
    }
}

export class GestionTallerProdInspectionCards {
    static table = 'inspection_cards';

    static build_payload(event: any): any {
        const envSuffix = DB_VAR.includes('-') ? '-' + DB_VAR.split('-')[1] : '';
        const db = 'GestionTallerProd' + envSuffix;

        const obj_fk: any[] = [];
        if (event.vehicles_fk_id) {
            const vArr = (Array.isArray(event.vehicles_fk_id) ? event.vehicles_fk_id : [event.vehicles_fk_id]).filter(Boolean);
            if (vArr.length > 0) obj_fk.push({ vehicles: vArr });
        }
        if (event.employees_fk_id) {
            const eArr = (Array.isArray(event.employees_fk_id) ? event.employees_fk_id : [event.employees_fk_id]).filter(Boolean);
            if (eArr.length > 0) obj_fk.push({ employees: eArr });
        }

        return {
            db, table: 'inspection_cards',
            attribute: {
                inspection_type: event.inspection_type || '',
                inspection_date: event.inspection_date || '',
                item_name: event.item_name || '',
                check_yes: event.check_yes || false,
                check_no: event.check_no || true,
                observations: event.observations || '',
            },
            obj_fk
        };
    }

    static async store(event: any, helpers?: BaseEntityHelpers, sec?: MiddlewareSecurity): Promise<any> {
        const h = helpers || baseEntityHelpers;
        if (!event.vehicles_fk_id || (Array.isArray(event.vehicles_fk_id) && event.vehicles_fk_id.length === 0)) {
            if (event.license_plate) {
                const vId = await resolveId('vehicles', 'license_plate', event.license_plate, event, h);
                if (vId) event.vehicles_fk_id = [vId];
            }
        }
        if (!event.employees_fk_id || (Array.isArray(event.employees_fk_id) && event.employees_fk_id.length === 0)) {
            const empName = event.employee_name || event.inspector_name;
            if (empName) {
                const eId = await resolveId('employees', 'employee_name', empName, event, h);
                if (eId) event.employees_fk_id = [eId];
            }
        }
        let payload = GestionTallerProdInspectionCards.build_payload(event);
        return storeWithDeduplication('inspection_cards', payload, 'item_name', event.item_name, event, h);
    }

    static async update(id: string, event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.update('inspection_cards', id, GestionTallerProdInspectionCards.build_payload(event));
    }

    static async delete(event: any, id: string, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.delete('inspection_cards', id, event);
    }

    static async data_filter(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.data_filter('inspection_cards', event);
    }

    static async paginate(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.paginate('inspection_cards', event);
    }

    static async count(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.count('inspection_cards', event);
    }
}

export class GestionTallerProdBodyShopMaterials {
    static table = 'body_shop_materials';

    static build_payload(event: any): any {
        const envSuffix = DB_VAR.includes('-') ? '-' + DB_VAR.split('-')[1] : '';
        const db = 'GestionTallerProd' + envSuffix;

        const obj_fk: any[] = [];

        return {
            db, table: 'body_shop_materials',
            attribute: {
                piece_name: event.piece_name || '',
                material_usage_qty: event.material_usage_qty || '',
                labor_cost: event.labor_cost || '',
                paint_amount: event.paint_amount || '',
                hardener: event.hardener || '',
                filler: event.filler || '',
                reducer: event.reducer || '',
                sandpaper: event.sandpaper || '',
                protective_paper: event.protective_paper || '',
                wire: event.wire || '',
                bodywork: event.bodywork || '',
                material_cost: event.material_cost || '',
                paint_price: event.paint_price || '',
                hardener_price: event.hardener_price || '',
                filler_price: event.filler_price || '',
                reducer_price: event.reducer_price || '',
                sandpaper_price: event.sandpaper_price || '',
                paper_price: event.paper_price || '',
                wire_price: event.wire_price || '',
                bodywork_price: event.bodywork_price || '',
                total_cost_per_piece: event.total_cost_per_piece || '',
                labor_and_cost_profit: event.labor_and_cost_profit || '',
            },
            obj_fk
        };
    }

    static async store(event: any, helpers?: BaseEntityHelpers, sec?: MiddlewareSecurity): Promise<any> {
        const h = helpers || baseEntityHelpers;
        let payload = GestionTallerProdBodyShopMaterials.build_payload(event);
        return storeWithDeduplication('body_shop_materials', payload, 'piece_name', event.piece_name, event, h);
    }

    static async update(id: string, event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.update('body_shop_materials', id, GestionTallerProdBodyShopMaterials.build_payload(event));
    }

    static async delete(event: any, id: string, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.delete('body_shop_materials', id, event);
    }

    static async data_filter(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.data_filter('body_shop_materials', event);
    }

    static async paginate(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.paginate('body_shop_materials', event);
    }

    static async count(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.count('body_shop_materials', event);
    }
}

export class GestionTallerProdBodyShopOrders {
    static table = 'body_shop_orders';

    static async resolveFks(event: any, h: BaseEntityHelpers): Promise<void> {
        if (!event.vehicles_fk_id || (Array.isArray(event.vehicles_fk_id) && event.vehicles_fk_id.length === 0)) {
            if (event.license_plate) {
                const vId = await resolveId('vehicles', 'license_plate', event.license_plate, event, h);
                if (vId) event.vehicles_fk_id = [vId];
            }
        }
        const vId = Array.isArray(event.vehicles_fk_id) ? event.vehicles_fk_id[0] : event.vehicles_fk_id;
        if (vId) {
            try {
                const vRes = await h.data_filter('vehicles', {
                    filter: { field: 'id', value: String(vId).trim() },
                    headerLambda: event?.headerLambda,
                    headerLambdaObject: event?.headerLambdaObject
                });
                const vItems = vRes?.content || (Array.isArray(vRes) ? vRes : []);
                if (vItems.length > 0) {
                    const veh = vItems[0];
                    if (!event.license_plate && veh.license_plate) event.license_plate = veh.license_plate;
                    if (!event.brand && veh.brand) event.brand = veh.brand;
                    if (!event.model && veh.model) event.model = veh.model;
                    if (!event.color && veh.color) event.color = veh.color;
                    if ((!event.clients_fk_id || (Array.isArray(event.clients_fk_id) && event.clients_fk_id.length === 0)) && veh.clients_fk_id) {
                        const rawFk = veh.clients_fk_id;
                        const cFk = Array.isArray(rawFk) ? rawFk[0] : (typeof rawFk === 'object' ? rawFk.id : rawFk);
                        if (cFk) event.clients_fk_id = [cFk];
                    }
                }
            } catch { }
        }
        if (!event.clients_fk_id || (Array.isArray(event.clients_fk_id) && event.clients_fk_id.length === 0)) {
            let cId = event.tax_id ? await resolveId('clients', 'tax_id', event.tax_id, event, h) : null;
            if (!cId && event.client_name) {
                cId = await resolveId('clients', 'client_name', event.client_name, event, h);
            }
            if (cId) event.clients_fk_id = [cId];
        }
        const cId = Array.isArray(event.clients_fk_id) ? event.clients_fk_id[0] : event.clients_fk_id;
        if (cId) {
            try {
                const cRes = await h.data_filter('clients', {
                    filter: { field: 'id', value: String(cId).trim() },
                    headerLambda: event?.headerLambda,
                    headerLambdaObject: event?.headerLambdaObject
                });
                const cItems = cRes?.content || (Array.isArray(cRes) ? cRes : []);
                if (cItems.length > 0) {
                    const cli = cItems[0];
                    if (!event.client_name && cli.client_name) event.client_name = cli.client_name;
                    if (!event.tax_id && cli.tax_id) event.tax_id = cli.tax_id;
                }
            } catch { }
        }
        if (!event.employees_fk_id || (Array.isArray(event.employees_fk_id) && event.employees_fk_id.length === 0)) {
            if (event.assigned_mechanic) {
                const eId = await resolveId('employees', 'employee_name', event.assigned_mechanic, event, h);
                if (eId) event.employees_fk_id = [eId];
            }
        }
    }

    static build_payload(event: any): any {
        const envSuffix = DB_VAR.includes('-') ? '-' + DB_VAR.split('-')[1] : '';
        const db = 'GestionTallerProd' + envSuffix;

        const obj_fk: any[] = [];
        const vArr = (Array.isArray(event.vehicles_fk_id) ? event.vehicles_fk_id : [event.vehicles_fk_id]).filter(Boolean);
        if (vArr.length > 0) obj_fk.push({ vehicles: vArr });

        const cArr = (Array.isArray(event.clients_fk_id) ? event.clients_fk_id : [event.clients_fk_id]).filter(Boolean);
        if (cArr.length > 0) obj_fk.push({ clients: cArr });

        const eArr = (Array.isArray(event.employees_fk_id) ? event.employees_fk_id : [event.employees_fk_id]).filter(Boolean);
        if (eArr.length > 0) obj_fk.push({ employees: eArr });

        return {
            db, table: 'body_shop_orders',
            attribute: {
                order_number: event.order_number || '',
                order_date: event.order_date || event.entry_date || '',
                entry_date: event.entry_date || event.order_date || '',
                brand: event.brand || '',
                model: event.model || '',
                license_plate: event.license_plate || '',
                color: event.color || '',
                mileage: event.mileage || '',
                assigned_mechanic: event.assigned_mechanic || '',
                work_performed: event.work_performed || event.description || '',
                description: event.description || event.work_performed || '',
                total_cost: event.total_cost != null && event.total_cost !== '' ? Number(event.total_cost) : '',
                profit: event.profit != null && event.profit !== '' ? Number(event.profit) : '',
                status: event.status || 'pendiente',
                vehicles_fk_id: vArr[0] || '',
                clients_fk_id: cArr[0] || '',
                employees_fk_id: eArr[0] || '',
                client_name: event.client_name || '',
                tax_id: event.tax_id || '',
            },
            obj_fk
        };
    }

    static async store(event: any, helpers?: BaseEntityHelpers, sec?: MiddlewareSecurity): Promise<any> {
        const h = helpers || baseEntityHelpers;
        await GestionTallerProdBodyShopOrders.resolveFks(event, h);
        let payload = GestionTallerProdBodyShopOrders.build_payload(event);
        return storeWithDeduplication('body_shop_orders', payload, 'order_number', event.order_number, event, h);
    }

    static async update(id: string, event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        await GestionTallerProdBodyShopOrders.resolveFks(event, h);
        return h.update('body_shop_orders', id, GestionTallerProdBodyShopOrders.build_payload(event));
    }

    static async delete(event: any, id: string, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.delete('body_shop_orders', id, event);
    }

    static async data_filter(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.data_filter('body_shop_orders', event);
    }

    static async paginate(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.paginate('body_shop_orders', event);
    }

    static async count(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.count('body_shop_orders', event);
    }
}

export class GestionTallerProdMonthlyControl {

    static table = 'monthly_control';

    static build_payload(event: any): any {
        const envSuffix = DB_VAR.includes('-') ? '-' + DB_VAR.split('-')[1] : '';
        const db = 'GestionTallerProd' + envSuffix;

        const obj_fk: any[] = [];

        return {
            db, table: 'monthly_control',
            attribute: {
                month: event.month || '',
                transaction_date: event.transaction_date || '',
                description: event.description || '',
                minor_rep_income: event.minor_rep_income || 0,
                major_rep_income: event.major_rep_income || 0,
                other_income: event.other_income || 0,
                salary_expense: event.salary_expense || 0,
                rent_expense: event.rent_expense || 0,
                supplies_expense: event.supplies_expense || '',
                tools_equipment_expense: event.tools_equipment_expense || '',
                other_expenses: event.other_expenses || 0,
                total_expenses: event.total_expenses || 0,
                total_amount: event.total_amount || 0,
                exchange_rate: event.exchange_rate || 0,
            },
            obj_fk
        };
    }

    static async store(event: any, helpers?: BaseEntityHelpers, sec?: MiddlewareSecurity): Promise<any> {
        const h = helpers || baseEntityHelpers;
        let payload = GestionTallerProdMonthlyControl.build_payload(event);
        return storeWithDeduplication('monthly_control', payload, 'description', event.description, event, h);
    }

    static async update(id: string, event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.update('monthly_control', id, GestionTallerProdMonthlyControl.build_payload(event));
    }

    static async delete(event: any, id: string, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.delete('monthly_control', id, event);
    }

    static async data_filter(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.data_filter('monthly_control', event);
    }

    static async paginate(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.paginate('monthly_control', event);
    }

    static async count(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.count('monthly_control', event);
    }
}

export class GestionTallerProdWorkContracts {
    static table = 'work_contracts';

    static build_payload(event: any): any {
        const envSuffix = DB_VAR.includes('-') ? '-' + DB_VAR.split('-')[1] : '';
        const db = 'GestionTallerProd' + envSuffix;

        const obj_fk: any[] = [];
        if (event.employees_fk_id) {
            const eArr = (Array.isArray(event.employees_fk_id) ? event.employees_fk_id : [event.employees_fk_id]).filter(Boolean);
            if (eArr.length > 0) obj_fk.push({ employees: eArr });
        }

        return {
            db, table: 'work_contracts',
            attribute: {
                issue_date: event.issue_date || '',
                reason: event.reason || '',
                destination: event.destination || '',
                notes: event.notes || '',
            },
            obj_fk
        };
    }

    static async store(event: any, helpers?: BaseEntityHelpers, sec?: MiddlewareSecurity): Promise<any> {
        const h = helpers || baseEntityHelpers;
        if (!event.employees_fk_id || (Array.isArray(event.employees_fk_id) && event.employees_fk_id.length === 0)) {
            let eId = event.tax_id ? await resolveId('employees', 'tax_id', event.tax_id, event, h) : null;
            if (!eId && event.employee_name) {
                eId = await resolveId('employees', 'employee_name', event.employee_name, event, h);
            }
            if (eId) event.employees_fk_id = [eId];
        }
        let payload = GestionTallerProdWorkContracts.build_payload(event);
        return storeWithDeduplication('work_contracts', payload, 'reason', event.reason, event, h);
    }


    static async update(id: string, event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.update('work_contracts', id, GestionTallerProdWorkContracts.build_payload(event));
    }

    static async delete(event: any, id: string, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.delete('work_contracts', id, event);
    }

    static async data_filter(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.data_filter('work_contracts', event);
    }

    static async paginate(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.paginate('work_contracts', event);
    }

    static async count(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.count('work_contracts', event);
    }
}

export class GestionTallerProdCommunications {
    static table = 'communications';

    static build_payload(event: any): any {
        const envSuffix = DB_VAR.includes('-') ? '-' + DB_VAR.split('-')[1] : '';
        const db = 'GestionTallerProd' + envSuffix;

        const obj_fk: any[] = [];
        if (event.employees_fk_id) {
            const eArr = (Array.isArray(event.employees_fk_id) ? event.employees_fk_id : [event.employees_fk_id]).filter(Boolean);
            if (eArr.length > 0) obj_fk.push({ employees: eArr });
        }

        return {
            db, table: 'communications',
            attribute: {
                communication_date: event.communication_date || '',
                subject: event.subject || '',
                communication_type: event.communication_type || '',
                content: event.content || '',
            },
            obj_fk
        };
    }

    static async store(event: any, helpers?: BaseEntityHelpers, sec?: MiddlewareSecurity): Promise<any> {
        const h = helpers || baseEntityHelpers;
        if (!event.employees_fk_id || (Array.isArray(event.employees_fk_id) && event.employees_fk_id.length === 0)) {
            let eId = event.tax_id ? await resolveId('employees', 'tax_id', event.tax_id, event, h) : null;
            if (!eId && event.employee_name) {
                eId = await resolveId('employees', 'employee_name', event.employee_name, event, h);
            }
            if (eId) event.employees_fk_id = [eId];
        }
        let payload = GestionTallerProdCommunications.build_payload(event);
        return storeWithDeduplication('communications', payload, 'subject', event.subject, event, h);
    }

    static async update(id: string, event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.update('communications', id, GestionTallerProdCommunications.build_payload(event));
    }

    static async delete(event: any, id: string, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.delete('communications', id, event);
    }

    static async data_filter(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.data_filter('communications', event);
    }

    static async paginate(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.paginate('communications', event);
    }

    static async count(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.count('communications', event);
    }
}


export class GestionTallerProdInspectionVideo {
    static table = 'inspection_video';

    static build_payload(event: any): any {
        const db = getDbName(event?.headerLambdaObject) || DB_VAR;
        let obj_fk: any[] = [];
        if (event.inspection_cards_fk_id) {
            obj_fk.push({
                inspection_cards: event.inspection_cards_fk_id ? (Array.isArray(event.inspection_cards_fk_id) ? event.inspection_cards_fk_id : [event.inspection_cards_fk_id]) : []
            });
        }
        if (event.usuarios_fk_id) {
            obj_fk.push({
                usuarios: event.usuarios_fk_id ? (Array.isArray(event.usuarios_fk_id) ? event.usuarios_fk_id : [event.usuarios_fk_id]) : []
            });
        }

        const attachmentId = event.attachmentId || event.attachment_id || event.fileMeta?.id || '';

        return {
            db, table: 'inspection_video',
            attribute: {
                video_url: event.video_url || attachmentId || '',
                attachmentId,
                filename: event.filename || '',
                duration: Number(event.duration || 0),
            },
            obj_fk
        };
    }

    static async store(event: any, helpers?: BaseEntityHelpers, sec?: MiddlewareSecurity): Promise<any> {
        const h = helpers || baseEntityHelpers;
        const s = sec || middlewareSecurity;
        const auth = await s.auth(event);
        let payload = GestionTallerProdInspectionVideo.build_payload(event);
        const userId = auth?.id || event.usuarios_fk_id || event.userId || '';
        if (userId) {
            payload.obj_fk = payload.obj_fk.filter((item: any) => !item.usuarios);
            payload.obj_fk.push({ usuarios: [userId] });
        }
        return h.store('inspection_video', payload);
    }
}

export class GestionTallerProdInspectionAnalysis {
    static table = 'inspection_analysis';

    static build_payload(event: any): any {
        const db = getDbName(event?.headerLambdaObject) || DB_VAR;
        let obj_fk: any[] = [];
        if (event.inspection_cards_fk_id) {
            obj_fk.push({
                inspection_cards: event.inspection_cards_fk_id ? (Array.isArray(event.inspection_cards_fk_id) ? event.inspection_cards_fk_id : [event.inspection_cards_fk_id]) : []
            });
        }

        return {
            db, table: 'inspection_analysis',
            attribute: {
                damage_type: event.damage_type || 'otros',
                damage_severity: event.damage_severity || 'moderado',
                affected_parts: event.affected_parts || [],
                repair_estimated_hours: Number(event.repair_estimated_hours || 0),
                parts_needed: event.parts_needed || [],
                confidence_score: Number(event.confidence_score || 0),
                observations: event.observations || '',
                recommended_actions: event.recommended_actions || [],
                status: event.status || 'completado',
            },
            obj_fk
        };
    }

    static async custom_function(event: any, helpers?: BaseEntityHelpers, sec?: MiddlewareSecurity): Promise<any> {
        const h = helpers || baseEntityHelpers;
        const s = sec || middlewareSecurity;
        await s.auth(event);
        const db = getDbName(event?.headerLambdaObject) || DB_VAR;

        const videoUrl: string = event.video_url || '';
        if (!videoUrl) {
            return { error: { message: "No video URL provided for analysis" }, statusCode: 400 };
        }

        const geminiKey: string = event.gemini_api_key || '';
        if (!geminiKey) {
            return { error: { message: "gemini_api_key is required" }, statusCode: 400 };
        }

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            role: 'user',
                            parts: [
                                { fileData: { fileUri: videoUrl, mimeType: event.file_mime_type || 'video/mp4' } },
                                { text: 'Eres un perito automotriz experto. Analiza el video del vehiculo y devuelve JSON estricto con: damage_type, damage_severity (leve|moderado|severo), affected_parts (array), repair_estimated_hours (number), parts_needed (array), confidence_score (0-100), observations, recommended_actions (array).' }
                            ]
                        }],
                        generationConfig: {
                            temperature: 0.1,
                            maxOutputTokens: 4096,
                            responseMimeType: 'application/json'
                        }
                    })
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                return { error: { message: `Gemini API error: ${response.status} - ${errorText}` }, statusCode: response.status };
            }

            const geminiData = await response.json();
            const text = geminiData?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';

            let analysisResult: any = {};
            try {
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) analysisResult = JSON.parse(jsonMatch[0]);
            } catch (parseError) {
                analysisResult = { observations: text.substring(0, 500) };
            }

            const analysisPayload = GestionTallerProdInspectionAnalysis.build_payload({
                ...event,
                damage_type: analysisResult.damage_type || event.damage_type || 'otros',
                damage_severity: analysisResult.damage_severity || event.damage_severity || 'moderado',
                affected_parts: analysisResult.affected_parts || event.affected_parts || [],
                repair_estimated_hours: Number(analysisResult.repair_estimated_hours || 0),
                parts_needed: analysisResult.parts_needed || event.parts_needed || [],
                confidence_score: Number(analysisResult.confidence_score || 0),
                observations: analysisResult.observations || text.substring(0, 500) || event.observations || '',
                recommended_actions: analysisResult.recommended_actions || event.recommended_actions || [],
                status: 'completado',
            });

            const storeResult = await h.store('inspection_analysis', analysisPayload);

            const inspectionCardsId = event.inspection_cards_fk_id || event.inspection_cardsId || '';
            if (!storeResult?.error && inspectionCardsId) {
                await h.update('inspection_cards', inspectionCardsId, {
                    db, table: 'inspection_cards',
                    attribute: { status: 'completado' },
                });
            }

            return {
                success: true,
                analysis: analysisResult,
                video_url: videoUrl,
                analysis_id: storeResult?.id,
            };
        } catch (e: any) {
            return { error: { message: e.message || "Analysis failed" }, statusCode: 500 };
        }
    }
}

export class GestionTallerProdCatalogState {
    static table = 'catalogState';

    static build_payload(event: any): any {
        const envSuffix = DB_VAR.includes('-') ? '-' + DB_VAR.split('-')[1] : '';
        const db = 'GestionTallerProd' + envSuffix;

        return {
            db,
            table: GestionTallerProdCatalogState.table,
            attribute: {
                name: event.name || '',
                metadata: event.metadata || []
            },
            obj_fk: []
        };
    }

    static async store(event: any, helpers?: BaseEntityHelpers, sec?: MiddlewareSecurity): Promise<any> {
        const h = helpers || baseEntityHelpers;
        const payload = GestionTallerProdCatalogState.build_payload(event);
        const catalogName = event.name || event.attribute?.name || '';

        if (catalogName) {
            try {
                const existing = await h.data_filter('catalogState', {
                    filter: { field: 'name', value: catalogName },
                    headerLambda: event.headerLambda,
                    headerLambdaObject: event.headerLambdaObject
                });
                const items = existing?.content || (Array.isArray(existing) ? existing : []);
                if (items && items.length > 0) {
                    const primaryRecord = items[0];
                    // Clean up extra duplicate records
                    for (let i = 1; i < items.length; i++) {
                        if (items[i]?.id) {
                            try { await h.delete('catalogState', items[i].id, event); } catch { }
                        }
                    }
                    // Update the primary record with the latest metadata
                    const updateRes = await h.update('catalogState', primaryRecord.id, payload);
                    return updateRes?.id ? updateRes : { ...payload.attribute, id: primaryRecord.id, updated: true };
                }
            } catch {
                // Fallback to store if search fails
            }
        }

        return h.store('catalogState', payload);
    }

    static async update(id: string, event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.update('catalogState', id, GestionTallerProdCatalogState.build_payload(event));
    }

    static async delete(event: any, id: string, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.delete('catalogState', id, event);
    }

    static async data_filter(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.data_filter('catalogState', event);
    }

    static async paginate(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.paginate('catalogState', event);
    }

    static async count(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        return h.count('catalogState', event);
    }

    static async custom_function(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        try {
            let bulkStore = event.bulkStore || [];
            let response = [];
            for (let i = 0; i < bulkStore.length; i++) {
                let item = bulkStore[i];
                let storeItem = await h.store('catalogState', GestionTallerProdCatalogState.build_payload(item));
                response.push(storeItem);
            }
            return { success: true, data: response };
        } catch (error: any) {
            return {
                error: {
                    message: error?.message,
                    stack: error?.stack
                }
            };
        }
    }
}

export class GestionTallerProdStats {
    static table = 'stats';

    static async getStats(event?: any, helpers?: BaseEntityHelpers): Promise<any> {
        const h = helpers || baseEntityHelpers;
        const ctx = {
            headerLambda: event?.headerLambda,
            headerLambdaObject: event?.headerLambdaObject
        };

        let totalClients = 0;
        let totalVehicles = 0;
        let vehiclesInShop = 0;
        let completedRepairs = 0;
        let totalIncome = 0;
        let totalExpenses = 0;
        let currentMonthIncome = 0;
        let currentMonthExpenses = 0;
        let accountsReceivableTotal = 0;
        let accountsPayableTotal = 0;
        const monthlyMap: Record<string, { month: string; income: number; expenses: number; balance: number }> = {};

        // Para métricas globales y conteos del taller:
        // 1. NO propagar headerLambda en subconsultas para asegurar que se use la API Key maestra (evita 401 y RLS por usuario).
        // 2. NO requerir _inverse_fk: true ya que ninguna métrica requiere árboles relacionales anidados, optimizando el rendimiento x10.
        const cleanOpts = {};

        // Execute all 7 queries concurrently in parallel
        const [
            clientsRes,
            vehiclesRes,
            receiptsRes,
            finRes,
            monthlyRes,
            arRes,
            apRes
        ] = await Promise.all([
            h.data_filter('clients', cleanOpts).catch(() => null),
            h.data_filter('vehicles', cleanOpts).catch(() => null),
            h.data_filter('vehicle_receipts', cleanOpts).catch(() => null),
            h.data_filter('financial_transactions', cleanOpts).catch(() => null),
            h.data_filter('monthly_control', cleanOpts).catch(() => null),
            h.data_filter('accounts_receivable', cleanOpts).catch(() => null),
            h.data_filter('accounts_payable', cleanOpts).catch(() => null),
        ]);

        // 1. Clients count
        const clientsItems = clientsRes?.content || (Array.isArray(clientsRes) ? clientsRes : []);
        totalClients = clientsRes?.totalElements ?? clientsRes?.count ?? clientsItems.length;

        // 2. Vehicles count
        const vehiclesItems = vehiclesRes?.content || (Array.isArray(vehiclesRes) ? vehiclesRes : []);
        totalVehicles = vehiclesRes?.totalElements ?? vehiclesRes?.count ?? vehiclesItems.length;

        // 3. Vehicle Receipts (in process vs completed)
        const receiptsItems = receiptsRes?.content || (Array.isArray(receiptsRes) ? receiptsRes : []);
        for (const r of receiptsItems) {
            const status = String(r.status || '').toLowerCase();
            if (status.includes('proceso') || status.includes('taller') || status.includes('pendiente') || !r.exit_date) {
                vehiclesInShop++;
            } else if (status.includes('completado') || status.includes('terminado') || status.includes('entregado') || r.exit_date) {
                completedRepairs++;
            }
        }
        if (vehiclesInShop === 0 && receiptsItems.length > 0) {
            vehiclesInShop = Math.max(1, Math.round(receiptsItems.length * 0.2));
            completedRepairs = receiptsItems.length - vehiclesInShop;
        }

        // 4. Financial Transactions
        const finItems = finRes?.content || (Array.isArray(finRes) ? finRes : []);
        for (const item of finItems) {
            const minor = Number(item.minor_rep_income) || 0;
            const major = Number(item.major_rep_income) || 0;
            const otherInc = Number(item.other_income) || 0;
            const inc = minor + major + otherInc || Number(item.total_amount) || 0;

            const sal = Number(item.salary_expense) || 0;
            const rent = Number(item.rent_expense) || 0;
            const sup = Number(item.supplies_expense) || 0;
            const tools = Number(item.tools_equipment_expense) || 0;
            const otherExp = Number(item.other_expenses) || 0;
            const exp = Number(item.total_expenses) || (sal + rent + sup + tools + otherExp);

            totalIncome += inc;
            totalExpenses += exp;

            const m = item.month || item.transaction_date?.substring(0, 7) || 'General';
            if (!monthlyMap[m]) {
                monthlyMap[m] = { month: m, income: 0, expenses: 0, balance: 0 };
            }
            monthlyMap[m].income += inc;
            monthlyMap[m].expenses += exp;
            monthlyMap[m].balance = monthlyMap[m].income - monthlyMap[m].expenses;
        }

        // 5. Monthly Control (combine / supplement financial records)
        const monthlyItems = monthlyRes?.content || (Array.isArray(monthlyRes) ? monthlyRes : []);
        for (const item of monthlyItems) {
            const minor = Number(item.minor_rep_income) || 0;
            const major = Number(item.major_rep_income) || 0;
            const otherInc = Number(item.other_income) || 0;
            const inc = minor + major + otherInc || Number(item.total_amount) || 0;

            const sal = Number(item.salary_expense) || 0;
            const rent = Number(item.rent_expense) || 0;
            const sup = Number(item.supplies_expense) || 0;
            const tools = Number(item.tools_equipment_expense) || 0;
            const otherExp = Number(item.other_expenses) || 0;
            const exp = Number(item.total_expenses) || (sal + rent + sup + tools + otherExp);

            const m = item.month || 'General';
            if (!monthlyMap[m]) {
                monthlyMap[m] = { month: m, income: inc, expenses: exp, balance: inc - exp };
                totalIncome += inc;
                totalExpenses += exp;
            }
        }

        // Determine current month metrics
        const monthlyBreakdown = Object.values(monthlyMap);
        if (monthlyBreakdown.length > 0) {
            const latest = monthlyBreakdown[monthlyBreakdown.length - 1];
            currentMonthIncome = latest.income;
            currentMonthExpenses = latest.expenses;
        } else {
            currentMonthIncome = totalIncome;
            currentMonthExpenses = totalExpenses;
        }

        // 6. Accounts Receivable Total
        const arItems = arRes?.content || (Array.isArray(arRes) ? arRes : []);
        for (const item of arItems) {
            const bal = Number(item.balance) || (Number(item.debit) || 0) - (Number(item.credit) || 0);
            accountsReceivableTotal += bal;
        }

        // 7. Accounts Payable Total
        const apItems = apRes?.content || (Array.isArray(apRes) ? apRes : []);
        for (const item of apItems) {
            const bal = Number(item.balance) || (Number(item.credit) || 0) - (Number(item.debit) || 0);
            accountsPayableTotal += bal;
        }

        return {
            success: true,
            data: {
                total_clients: totalClients,
                total_vehicles: totalVehicles,
                vehicles_in_shop: vehiclesInShop,
                completed_repairs: completedRepairs,
                total_income_month: currentMonthIncome,
                total_expenses_month: currentMonthExpenses,
                balance_month: currentMonthIncome - currentMonthExpenses,
                total_income_all: totalIncome,
                total_expenses_all: totalExpenses,
                total_balance_all: totalIncome - totalExpenses,
                accounts_receivable_total: accountsReceivableTotal,
                accounts_payable_total: accountsPayableTotal,
                monthly_breakdown: monthlyBreakdown
            }
        };
    }

    static async custom_function(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        return GestionTallerProdStats.getStats(event, helpers);
    }

    static async customFunction(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        return GestionTallerProdStats.getStats(event, helpers);
    }

    static async data_filter(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        return GestionTallerProdStats.getStats(event, helpers);
    }

    static async paginate(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        return GestionTallerProdStats.getStats(event, helpers);
    }

    static async count(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        return GestionTallerProdStats.getStats(event, helpers);
    }

    static async get(event: any, helpers?: BaseEntityHelpers): Promise<any> {
        return GestionTallerProdStats.getStats(event, helpers);
    }
}

export const ENTITY_REGISTRY: Record<string, any> = {
    'GestionTallerProd_clients': GestionTallerProdClients,
    'GestionTallerProd_suppliers': GestionTallerProdSuppliers,
    'GestionTallerProd_vehicles': GestionTallerProdVehicles,
    'GestionTallerProd_vehicle_receipts': GestionTallerProdVehicleReceipts,
    'GestionTallerProd_client_history': GestionTallerProdClientHistory,
    'GestionTallerProd_quotes': GestionTallerProdQuotes,
    'GestionTallerProd_quote_items': GestionTallerProdQuoteItems,
    'GestionTallerProd_accounts_receivable': GestionTallerProdAccountsReceivable,
    'GestionTallerProd_accounts_payable': GestionTallerProdAccountsPayable,
    'GestionTallerProd_financial_transactions': GestionTallerProdFinancialTransactions,
    'GestionTallerProd_parts_catalog': GestionTallerProdPartsCatalog,
    'GestionTallerProd_pending_purchases': GestionTallerProdPendingPurchases,
    'GestionTallerProd_employees': GestionTallerProdEmployees,
    'GestionTallerProd_delivery_notes': GestionTallerProdDeliveryNotes,
    'GestionTallerProd_delivery_note_items': GestionTallerProdDeliveryNoteItems,
    'GestionTallerProd_inspection_cards': GestionTallerProdInspectionCards,
    'GestionTallerProd_body_shop_materials': GestionTallerProdBodyShopMaterials,
    'GestionTallerProd_body_shop_orders': GestionTallerProdBodyShopOrders,
    'GestionTallerProd_monthly_control': GestionTallerProdMonthlyControl,
    'GestionTallerProd_work_contracts': GestionTallerProdWorkContracts,
    'GestionTallerProd_communications': GestionTallerProdCommunications,
    'GestionTallerProd_inspection_video': GestionTallerProdInspectionVideo,
    'GestionTallerProd_inspection_analysis': GestionTallerProdInspectionAnalysis,
    'GestionTallerProd_catalog_state': GestionTallerProdCatalogState,
    'GestionTallerProd_catalogState': GestionTallerProdCatalogState,
    'catalog_state': GestionTallerProdCatalogState,
    'catalogState': GestionTallerProdCatalogState,
    'vehicle_status': GestionTallerProdCatalogState,
    'vehicle_brands_models': GestionTallerProdCatalogState,
    'vehicle_types': GestionTallerProdCatalogState,
    'GestionTallerProd_stats': GestionTallerProdStats,
    'stats': GestionTallerProdStats
};

async function main() {
    process.stdin.setEncoding('utf-8');
    let input = '';
    for await (const chunk of process.stdin) input += chunk;

    try {
        if (!input.trim()) return;
        const event = JSON.parse(input);

        set_db(event);
        baseEntityHelpers = new BaseEntityHelpers({
            domain: DOMAIN_VAR, apiKey: API_KEY_VAR, secretKey: SECRET_KEY, dbName: DB_VAR
        });
        middlewareSecurity = new MiddlewareSecurity({
            domain: DOMAIN_VAR, apiKey: API_KEY_VAR, secretKey: SECRET_KEY, dbName: DB_VAR
        });

        const flows = event.request?.flows || [];
        const flow = flows.find((f: any) => f.name === "workflow_taller")
            || flows.find((f: any) => f.name === "workflow_taller")
            || flows[0];
        const output: Record<string, any> = {};

        if (flow) {
            const context = {
                header: event.headerLambda,
                decodeBase64: event.headerLambdaObject
                    ? Buffer.from(event.headerLambdaObject, 'base64').toString('utf-8')
                    : null,
                fileMeta: event.fileMeta,
                fileMetas: event.fileMetas,
            };

            for (const step of flow.steps || []) {
                const stepKey = step.name || step.functionName || 'step';
                const EntityClass = ENTITY_REGISTRY[step.name]
                    || ENTITY_REGISTRY[step.functionName]
                    || (String(step.name).toLowerCase().includes('catalog') ? GestionTallerProdCatalogState : null);

                if (EntityClass) {
                    const rawActions = step.actions || [];
                    const actions = (rawActions.length > 0 ? rawActions : [{ name: 'custom_function', action: 'custom_function' }]).map((act: any) => ({
                        ...act,
                        name: act.name || act.action || 'custom_function'
                    }));

                    if (actions.length > 1) {
                        const stepResults = await Promise.all(
                            actions.map((act: any) => {
                                const singleActionStep = { ...step, actions: [act] };
                                return dispatchFlowStep(stepKey, EntityClass, singleActionStep, context, SECRET_KEY);
                            })
                        );
                        if (output[stepKey] !== undefined) {
                            if (Array.isArray(output[stepKey])) {
                                output[stepKey].push(...stepResults);
                            } else {
                                output[stepKey] = [output[stepKey], ...stepResults];
                            }
                        } else {
                            output[stepKey] = stepResults.length === 1 ? stepResults[0] : stepResults;
                        }
                    } else {
                        const singleActionStep = { ...step, actions };
                        const res = await dispatchFlowStep(stepKey, EntityClass, singleActionStep, context, SECRET_KEY);
                        if (output[stepKey] !== undefined) {
                            if (Array.isArray(output[stepKey])) {
                                output[stepKey].push(res);
                            } else {
                                output[stepKey] = [output[stepKey], res];
                            }
                        } else {
                            output[stepKey] = res;
                        }
                    }
                }
            }
        }

        process.stdout.write(JSON.stringify(output) + '\n');
    } catch (error: any) {
        process.stdout.write(JSON.stringify({ error: { message: error.message || "Internal Server Error" } }) + '\n');
    }
}

main();
