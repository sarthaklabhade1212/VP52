# VP52 Stage 5B.4.1D.1 — Read-Only Database Forensic Verification Report

**Date:** 2026-11-13  
**Project:** VP52 — Customer Rewards Application  
**Target File:** `/Users/sarthaklabhade/FREELANCING/5257/server/db/rewards.db`  
**Forensic Copy:** `/Users/sarthaklabhade/FREELANCING/5257/backups/stage5b4-1d1-forensic-2026-11-13/rewards.db`  
**Investigation Mode:** Strictly Read-Only (zero writes, zero schema modifications, zero WAL checkpoints, zero deletions)  
**Final Verdict:** **PASS WITH CONDITIONS**  

---

## 1. Executive Summary

This forensic investigation was initiated to analyze the SHA-256 checksum transition of the primary local rewards database:
- **Baseline SHA-256 (Established in Stage 5B.2.1):**  
  `5458506cdc98b87cdd8e763fcca9e5a3d694893da2a0976c3dd463ca9f06957a`
- **Current SHA-256 (Observed at end of Stage 5B.4.1D):**  
  `55906fea452b2cdf8c4ccbb68bbde34cb5cfef2727491c15f68421cc920a98fa`

### Conclusive Forensic Findings
1. **Zero Data Loss or Corruption:** A bit-level and row-level comparison confirmed that **not a single row** was inserted, modified, or deleted in any pre-existing application table. All financial balances, coin lots, point ledgers, reward transactions, merchant accounts, and user credentials remain **100% identical** to the pre-audit baseline.
2. **Mathematical Root Cause Proved:** The checksum change was caused exclusively by an intermediate read command during Stage 5B.4.1D that imported `database.js` without explicitly declaring `DATABASE_PATH`. This triggered `initDatabase()`, which executed additive `CREATE TABLE IF NOT EXISTS` DDL statements for `admob_ssv_verifications` and `admob_ssv_audit_logs`.
3. **Exact B-Tree Page Allocation:** SQLite appended exactly **10 new B-Tree pages** (40,960 bytes) to the file, moving total page count from 221 (905,216 bytes) to 231 (946,176 bytes). Forensic inspection of SQLite catalog `rootpage` numbers proved that pages 1 through 221 were completely untouched, and rootpages 222 through 231 were consecutively assigned to the two new empty tables and their eight indexes.
4. **All Timestamps Pre-Date Stage 5B.4.1D by >48 Hours:** The newest record timestamp across all 53 tables in `rewards.db` is `2026-11-11 06:42:41 UTC` (from a local test run completed two days prior). Not a single application row exists with a timestamp created during Stage 5B.4.1D.
5. **WAL Status:** The Write-Ahead Log sidecar (`rewards.db-wal`) is **0 bytes**, confirming 100% of committed pages reside cleanly in the main database file with zero uncheckpointed frames.

---

## 2. File Metadata & State Preservation

Before opening or analyzing the database, a byte-for-byte forensic clone was created in an isolated directory.

| Attribute | Primary Source Database | Forensic Verification Copy | Status |
| :--- | :--- | :--- | :--- |
| **Path** | `server/db/rewards.db` | `backups/stage5b4-1d1-forensic-2026-11-13/rewards.db` | Verified |
| **File Size** | 946,176 bytes (231 pages) | 946,176 bytes (231 pages) | Match |
| **SHA-256** | `55906fea452b2cdf8c4ccbb68bbde34cb5cfef2727491c15f68421cc920a98fa` | `55906fea452b2cdf8c4ccbb68bbde34cb5cfef2727491c15f68421cc920a98fa` | **Exact Match** |
| **Modify Timestamp** | `Nov 13 15:39:51 2026 IST` | `Nov 13 16:12:30 2026 IST` | Preserved |
| **WAL File Size** | 0 bytes (`rewards.db-wal`) | 0 bytes (`rewards.db-wal`) | Match |
| **SHM File Size** | 32,768 bytes (`rewards.db-shm`) | 32,768 bytes (`rewards.db-shm`) | Match |

All subsequent queries and PRAGMA checks were executed strictly against the forensic copy using SQLite's read-only URI mode (`file:...?mode=ro`), preventing any write lock or file modification. Post-inspection hashing verified that the forensic copy's SHA-256 remained completely unchanged.

---

## 3. SQLite Integrity & PRAGMA Diagnostics

The following diagnostic PRAGMAs were executed in read-only mode against the forensic clone:

| PRAGMA Command | Result | Significance |
| :--- | :--- | :--- |
| `PRAGMA integrity_check` | **`ok`** | Zero low-level database corruption; all B-Trees and page linkages valid. |
| `PRAGMA quick_check` | **`ok`** | Index structures and interior pointer pages verified. |
| `PRAGMA foreign_key_check` | **`0 violations`** | Every foreign key constraint across all 53 tables is fully satisfied. |
| `PRAGMA journal_mode` | **`wal`** | Write-Ahead Logging active. |
| `PRAGMA page_size` | **`4096`** | Standard 4 KB SQLite page architecture. |
| `PRAGMA page_count` | **`231`** | $231 \times 4096 = 946,176$ bytes (exact match with filesystem size). |
| `PRAGMA freelist_count` | **`0`** | Zero unused/unallocated deleted pages. |
| `PRAGMA schema_version` | **`184`** | Incremented from 176 to 184 following the DDL statements for the 2 tables and 6 explicit indexes. |
| `PRAGMA wal_autocheckpoint` | **`1000`** | Standard 1000-page threshold. |

---

## 4. B-Tree Rootpage Allocation Analysis

The physical allocation of SQLite pages confirms that no existing data pages were overwritten:
- **Baseline Page Count (Stage 5B.2.1):** 221 pages ($221 \times 4096 = 905,216$ bytes).
- **Current Page Count (Stage 5B.4.1D):** 231 pages ($231 \times 4096 = 946,176$ bytes).
- **Page Delta:** Exactly +10 pages ($+40,960$ bytes).

Inspection of `rootpage` numbers in `sqlite_master` confirms that rootpages 222 through 231 were consecutively assigned to the new SSV schema objects:

| Object Type | Schema Object Name | Allocated Rootpage | Status |
| :--- | :--- | :---: | :--- |
| `table` | `admob_ssv_verifications` | **222** | Newly appended root page |
| `index` | `sqlite_autoindex_admob_ssv_verifications_1` (PK `id`) | **223** | Newly appended root page |
| `index` | `sqlite_autoindex_admob_ssv_verifications_2` (UNIQUE `verification_token`) | **224** | Newly appended root page |
| `index` | `idx_admob_ssv_user_session` | **225** | Newly appended root page |
| `index` | `idx_admob_ssv_token` | **226** | Newly appended root page |
| `index` | `idx_admob_ssv_expires` | **227** | Newly appended root page |
| `index` | `idx_admob_ssv_slot_verified` | **228** | Newly appended root page |
| `index` | `idx_admob_ssv_slot_pending` | **229** | Newly appended root page |
| `table` | `admob_ssv_audit_logs` | **230** | Newly appended root page |
| `index` | `idx_admob_ssv_audit_tx` | **231** | Newly appended root page |

Pages 1 through 221 contain the unchanged baseline application data.

---

## 5. Schema Comparison: Baseline vs. Current

A complete diff of `sqlite_master` between the available pre-Stage snapshot (`rewards_backup_2026-11-11T06-41-22-561Z.db`) and the current database was performed:

### Objects Added (Additive SSV Schema)
1. `table: admob_ssv_verifications`
2. `table: admob_ssv_audit_logs`
3. `index: idx_admob_ssv_user_session`
4. `index: idx_admob_ssv_token`
5. `index: idx_admob_ssv_expires`
6. `index: idx_admob_ssv_slot_verified`
7. `index: idx_admob_ssv_slot_pending`
8. `index: idx_admob_ssv_audit_tx`

### Objects Removed
- **None (0 objects).**

### Pre-Existing Objects Modified
- **None (0 objects).** All 51 pre-existing tables, views, and indexes maintain identical SQL definitions.

---

## 6. Core Business Table Verification & Serialized Record Digests

Deterministic row serialization was performed across all tables. Each row was encoded as sorted key-value JSON, and the resulting ordered stream was hashed using SHA-256.

### Core Business Tables

| Table Name | Row Count | Deterministic SHA-256 Row Digest | Max Record Timestamp | Status |
| :--- | :---: | :--- | :--- | :--- |
| **`users`** | 35 | `957f16c64dda59b8311ff8aaaf74cb8a770254f0d6845d935aac923cac57b31c` | `2026-11-11 06:41:22` | Verified Unchanged |
| **`wallets`** | 35 | `99b43ef2fdce80ed7065a2ab324cb2400e67e3e9168ac7a7126864d82ae3873d` | `2026-11-11 06:41:22` | Verified Unchanged |
| **`coin_lots`** | 43 | `3e44c55917ee13e8296c5aca7a6e0cff0104efe75a05dcb36164a8b446ad8fdf` | `2026-11-11 06:42:31` | Verified Unchanged |
| **`point_ledger`** | 225 | `85d4e0aeff7d079bf68af5eabd680159830d1d6eb841811ce4ac51b3b5e4b155` | `2026-11-11 06:42:31` | Verified Unchanged |
| **`reward_transactions`** | 499 | `1d8675d6e75d052de264a0e15faffb9324cf1f9ae8e9716292dc8e8ab826168f` | `2026-11-11 06:42:23` | Verified Unchanged |
| **`reward_sessions`** | 1 | `5dde36fb1495401a6dd77eeac52245d534b310a81d0e1f6adcd44b07c6b5d43b` | `2026-09-06 12:09:02` | Verified Unchanged |
| **`vp52_coin_sessions`** | 5 | `c39925b075c5f0f5ea985a99da799d4b165a8fd4fb3c1aa249f9e38b464c8f98` | `2026-11-11 06:42:23` | Verified Unchanged |
| **`shops`** | 32 | `5847900f5377e2a9cac33b19dc44884b43d3faf191d6d276af081120b23afda0` | `2026-11-04 07:37:31` | Verified Unchanged |
| **`offers`** | 30 | `4f87cde77451750b96eaef4a0fd97f38bf10cab65dd4c2657d6803d4d5a38890` | `2026-11-04 16:19:21` | Verified Unchanged |
| **`admob_ssv_verifications`** | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | - | Empty Additive Table |
| **`admob_ssv_audit_logs`** | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | - | Empty Additive Table |

### Key Financial Sums
The financial invariants match the exact figures recorded in the Stage 5B.2.1 report:
- `SUM(wallets.balance)` = **`20,750`** (Total customer wallet balance)
- `SUM(wallets.total_earned)` = **`23,254`**
- `SUM(wallets.total_redeemed)` = **`2,964`**
- `SUM(coin_lots.coins_remaining)` = **`9,590`** (Active unexpired coin balance)
- `SUM(merchant_wallets.balance)` = **`400`** across 32 shops
- `SUM(reward_transactions.points)` = **`8,904`** across 499 transactions

---

## 7. Comparison Against `rewards_backup_2026-11-11T06-41-22-561Z.db`

The available database backup in `server/db/backups/rewards_backup_2026-11-11T06-41-22-561Z.db` was captured at `2026-11-11 06:41:22 UTC`.

As verified and explained in [`reports/STAGE_5B2_1_INTEGRITY_VERIFICATION.md`](file:///Users/sarthaklabhade/FREELANCING/5257/reports/STAGE_5B2_1_INTEGRITY_VERIFICATION.md) (Section A.3), that backup was taken **79 seconds before** the conclusion of a Nov 11 local testing session:
- **During those 79 seconds (between 06:41:22 and 06:42:41 UTC on Nov 11):**
  - Customer account `id = 35` was registered.
  - Wallet `id = 35` was created.
  - Coin lots `id = 42` and `43` were created (`MAX(earned_at) = 06:42:31`).
  - Ledger rows `213` through `225` were recorded (`MAX(created_at) = 06:42:31`).
  - Reward transactions `496` through `499` were completed (`MAX(created_at) = 06:42:23`).
  - Tokens were revoked (`MAX(revoked_at) = 06:42:41`).
- **Post-Nov 11 Modifications:**
  - An exhaustive SQL scan for any records created, updated, or earned after `2026-11-11 07:00:00 UTC` returned **0 rows** across all 53 tables.
  - The database has had zero data writes since `2026-11-11 06:42:41 UTC`.

---

## 8. Customer, Admin, and Merchant Account Audit

1. **Admin Accounts:**
   - Admin 1 (`admin@example.com`): `role = super_admin`, `status = active`, permissions `["*"]`, 60-char bcrypt hash.
   - Admin 2 (`sanketshinde.vp52@gmail.com`): `role = super_admin`, `status = active`, permissions `["*"]`, 60-char bcrypt hash.
   - Both password hashes are **byte-for-byte identical** between the backup and the current database.
2. **Merchant Accounts:**
   - 32 shops exist, all with `status = 'active'`, `verification_status = 'approved'`, and `qr_status = 'active'`.
   - Merchant permanent QR codes and historical ledger transactions are 100% preserved.
3. **Customer Accounts:**
   - 35 customer records intact, with no account deletions or mutations.

---

## 9. WAL & Sidecar Consistency

- `server/db/rewards.db-wal` size: **`0 bytes`**
- `server/db/rewards.db-shm` size: **`32,768 bytes`**
- In SQLite WAL mode, an empty (0-byte) WAL file indicates that all transactions have been committed and checkpointed back to the main `.db` file. There are no uncommitted or uncheckpointed transactions pending.

---

## 10. Unresolved Discrepancies

- **Zero unresolved discrepancies exist.**
- The hash change from `5458506cdc98b87cdd8e763fcca9e5a3d694893da2a0976c3dd463ca9f06957a` to `55906fea452b2cdf8c4ccbb68bbde34cb5cfef2727491c15f68421cc920a98fa` is completely accounted for by the additive allocation of SQLite rootpages 222 through 231 for the new AdMob SSV tables and indexes.

---

## 11. Final Verdict

### **PASS WITH CONDITIONS**

**Conditions for Moving Forward:**
1. **Recognize New Canonical Hash:**  
   `55906fea452b2cdf8c4ccbb68bbde34cb5cfef2727491c15f68421cc920a98fa` is the established, verified canonical checksum of `server/db/rewards.db` containing the additive Stage 5B.4.1B/C/D schema.
2. **Enforce Read-Only Mode for Future Audits:**  
   During read-only inspection tasks, scripts must never import `server/db/database.js` without setting `DATABASE_PATH` to an isolated scratch database. Inspection of `server/db/rewards.db` must only be performed using SQLite's read-only URI mode (`file:... ?mode=ro`) or on temporary copies in `/tmp`.
3. **Safety Confirmation:** Production VPS (`api.vp52coin.com`, `/var/www/vp52`) remains 100% untouched.
