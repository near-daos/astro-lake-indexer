# Astro Lake Indexer

A service to read data from NEAR Lake AWS S3 database and import it into NEAR Indexer-like database.

## Run

Install packages:

```
npm install
```

Create config from example

```
cp .env.testnet.example .env
```

Sync database schema:

```
npm run schema:sync
```

Run migrations:

```
npm run migration:run
```

Build:
```
npm run build
```

Run:
```
npm run start
```

You can use `npm run start:debug` or `npm run start:trace` for verbose output.

### CLI helper

To download and output raw block data in JSON format:

```
npm run cli 12345
```

### Configuration

`START_BLOCK_HEIGHT` - height of block to start download from

`LOOK_BACK_BLOCKS` - number of blocks to cache before start (default: 20)

`TX_CACHE_SIZE` - max number of transactions to keep in cache (default: 1000)

`TX_HASHES_CACHE_SIZE` - max number of transaction hashes to keep in cache (default: 5000)

`FETCH_MAX_KEYS` - number of blocks to download at one iteration (default: 100)

`BLOCKS_DL_CONCURRENCY` - number of blocks to download at once (default: 10)

`WAIT_FOR_NEW_BLOCKS` - if there are no new blocks, wait (ms) before new request (default: 2000)

### Known issues

- Wrong `index_in_block` stored in `account_changes` table. Fixed in [e4d40c7b](https://github.com/near-daos/astro-lake-indexer/commit/e4d40c7bfcd6eecc95545ac3f4b486e67ec522b0). 
- Some account changes are missing from the NEAR indexer for explorer database (mainnet) for some reason. So number of records in `account_changes` won't match. 
 
    Affected accounts:
  - tenk.sputnik-dao.near (6 entries)
  - community.sputnik-dao.near (2 entries)
  - creatives.sputnik-dao.near (2 entries)
  - cudo.sputnik-dao.near (4 entries)
  - nearlend-dao.sputnik-dao.near (4 entries)
  - peaceinc.sputnik-dao.near (1 entry)
  - near-insider.sputnik-dao.near (2 entries).

- Wrong `emitted_index_of_event_entry_in_shard` stored in `events`, `assets__fungible_token_events` and `assets__non_fungible_token_events` tables. Fixed in [a1c6b7aa](https://github.com/near-daos/astro-lake-indexer/commit/a1c6b7aa0137348a5f453165f50d0c78db1358fa).

### FAQ

#### I get error "Not found parent tx hash for receipt/execution outcome"

Solution:

- increase `LOOK_BACK_BLOCKS` variable to download and cache all blocks between start block and block with failed receipt/execution outcome
- (or) increase value in `TX_HASHES_CACHE_SIZE` variable 

#### I get error "Not found full tx for hash"

Solution:

- Increase value in `TX_CACHE_SIZE` variable
