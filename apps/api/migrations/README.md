# migrations

SQL that `AutoMigrate` cannot write.

`grit migrate` runs `AutoMigrate` first, then every pending pair in this
directory in version order, and records each one in `grit_sql_migrations`.

```bash
grit generate migration rename_company_to_organisation
grit generate migration add_order_customer_index --index orders:customer_id

grit migrate                 # AutoMigrate, then the pending pairs
grit migrate status          # which pairs have run
grit migrate down --sql      # undo the most recent pair
```

## The file format

```
20261105120000_rename_company_to_organisation.up.sql
20261105120000_rename_company_to_organisation.down.sql
```

The version is a UTC timestamp and decides the order. The down file is the
reverse of the up file; leave it empty only when the change genuinely cannot
be undone, and say so in a comment, because an empty down file rolls back
silently and reads as a rollback that worked.

A file's statements run in one transaction. To opt out, make the first line:

```sql
-- grit:no-transaction
```

`CREATE INDEX CONCURRENTLY` needs this: Postgres refuses it inside a
transaction. `grit generate migration --index` writes the marker for you.

## What not to do

**Do not edit a pair that has already run.** The database has the old version
and the file has the new one, and nothing can reconcile them. `grit migrate`
compares a checksum and says so when it happens; write a new pair instead.

**Do not do in SQL what AutoMigrate already does.** Adding a column belongs in
the model. This directory is for what the model cannot express.

**Do not assume a transaction rolls back DDL.** Postgres rolls back a failed
`ALTER TABLE`. MySQL commits implicitly at every DDL statement, so half an
applied file stays applied there.
