# TripSheet — testing new enterprise features

Use a company admin (`admin@mkx.ca` / `mkx123` or your seeded admin). Ensure API is on and DB migrations for fleet/accounting/notification/company extensions have been applied (`prisma migrate deploy` per service).

---

## 1. Load economics & multi-stop

1. Open **Dispatch** → **+ Assign Load**.
2. Select a dispatch-ready driver, truck, trailer; set origin/destination.
3. Fill **Economics & stops**: customer rate `2500`, carrier cost `1800`, fuel surcharge `150`, accessorials `50`, detention hours `2`, detention rate `75`, miles `1200`, Stop 1 `Regina, SK`.
4. Save. Confirm the load card shows **Rev / Cost / Margin** and the intermediate stop.
5. Edit the load, change rates, save again.
6. Move status **Assigned → In transit → Delivered**. Confirm `actualDelivery` is set (OTP analytics use ETA vs actual).

**Pass:** Margin ≈ 2500+150+50+(2×75)−1800 = **1050**; stops visible on card.

---

## 2. Fleet ops (PM, repair, DVIR, expiry)

1. **Assets** → add a truck with insurance/plate/permit expiry dates (one in the past).
2. Optional: **Equipment** tab → add a non-truck/trailer unit.
3. **Fleet Ops** → **maintenance**: select asset, type PM or Repair, title/cost/date → Save. Confirm list row.
4. **dvir**: select asset + driver, status Satisfactory/Defects → Save.
5. **expiry**: confirm expired assets appear.

**Pass:** Maintenance and DVIR rows persist after refresh; expired asset listed under expiry.

---

## 3. Accounting — invoices, bills, payments, COA

1. **Accounting** → scroll to **Billing & AP/AR**.
2. **coa** → **Seed default accounts** → accounts list appears.
3. **invoices** → customer, optional load, dates, amount → Create. Status `sent`.
4. **bills** → vendor + amount → Create.
5. **payments** → Customer payment linked to invoice (partial or full) → Record. Invoice `amountPaid` / status updates toward paid.
6. Vendor payment against a bill similarly.

**Pass:** Lists refresh; applying payment reduces unpaid balance (visible on invoice line and Reports aging).

---

## 4. Settlements (existing)

1. Ensure a trip sheet has expenses for a driver in a date range.
2. **Accounting** → New settlement → approve → mark paid.

**Pass:** Status flow draft → approved → paid.

---

## 5. Analytics reports

1. **Reports** → **Analytics**.
2. Confirm cards: gross margin, CPM, fuel spend, driver pay, OTP %, AR unpaid.
3. Check **Revenue by lane**, **Invoice aging**, **Maintenance by truck**, **Load profitability**.

**Pass:** Numbers move after creating loads with rates, invoices, maintenance, and delivering with ETA/actual.

---

## 6. Compliance artifacts & audit

1. **Drivers** → open a driver → upload docs typed **BOL**, **POD**, **Rate Confirmation**, **Permit**, or **Border doc**.
2. **Compliance** tab → artifacts listed with type + driver.
3. Perform actions that write audit (message send, maintenance, invoice, expiry SMS).
4. **Compliance** → **Audit log** → events appear; **Refresh** works.
5. Optional: **Send expiry SMS** (admin user needs `phone`) → SMS shows under Reports → Recent SMS; audit `expiry.reminder`.

**Pass:** Compliance docs visible; audit trail non-empty. Note: **eManifest filing stays simulated** (not live CBSA).

---

## 7. Messaging & comments

1. **Messages** → pick driver, thread Driver/Internal/Customer, send message → appears in list.
2. Select a load → add **Load comment** → comments list updates.
3. **Customer / manual SMS** → phone + body → send; confirm under Reports SMS log.

**Pass:** Messages/comments persist after refresh; SMS logged (sent or simulated).

---

## 8. Regression smoke

1. Assign load still blocked without license/abstract/medical.
2. Track map / status updates still work.
3. Trip sheets + driver invite SMS still work.
4. Staging/prod: after deploy, run migrations on each service DB before UI tests.

---

## Known limitations (by design)

| Area | Behavior |
|------|----------|
| Live customs | eManifest UI + simulated filing only |
| Push notifications | Not implemented (in-app + SMS only) |
| Driver mobile chat | Admin Messages tab; no separate driver push client |
| Full GL journal | Chart of accounts seeded; no double-entry journal UI |

---

## Quick API checks (optional)

```bash
# replace TOKEN and COMPANY_ID
curl -H "Authorization: Bearer $TOKEN" "$API/reports/analytics?companyId=$COMPANY_ID"
curl -H "Authorization: Bearer $TOKEN" "$API/invoices?companyId=$COMPANY_ID"
curl -H "Authorization: Bearer $TOKEN" "$API/maintenance?companyId=$COMPANY_ID"
curl -H "Authorization: Bearer $TOKEN" "$API/messages?companyId=$COMPANY_ID"
curl -H "Authorization: Bearer $TOKEN" "$API/audit?companyId=$COMPANY_ID"
```
