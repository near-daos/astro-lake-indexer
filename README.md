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

`FETCH_MAX_KEYS` - number of blocks to download at one iteration (default: 100)

`BLOCKS_DL_CONCURRENCY` - number of blocks to download at once (default: 10)

`WAIT_FOR_NEW_BLOCKS` - if there are no new blocks, wait (ms) before new request (default: 2000)
