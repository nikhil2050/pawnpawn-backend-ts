/**
 * ============================================================================
 * import-sql.ts — SQL Schema Import Runner
 * ============================================================================
 * 
 * This TypeScript script reads sql/schema.sql and executes each SQL statement
 * against the PostgreSQL database using the 'pg' Node.js package.
 * 
 * Usage: npm run db:import
 * 
 * ============================================================================
 * JAVA → TYPESCRIPT CONCEPTS (for Java developers)
 * ============================================================================
 * 
 * 1. MODULES & IMPORTS
 *    Java:  import java.nio.file.Files;
 *    TS:    const { readFileSync } = require('fs')   (CommonJS)
 *           OR  import { readFileSync } from 'fs'    (ES Modules)
 *    We use require() here for compatibility with ts-node.
 * 
 * 2. VARIABLES
 *    Java:  final String URL = "...";   (immutable)
 *    TS:    const URL = "...";          (immutable, block-scoped)
 *    Java:  String url = "...";         (mutable)
 *    TS:    let url = "...";            (mutable, block-scoped)
 *    Note: There is no 'var' in modern TypeScript (use const or let).
 * 
 * 3. TYPES
 *    Java:  String sql;                 (explicit type)
 *    TS:    let sql;                     (type inferred, or 'any' if not inferred)
 *    TypeScript adds static types on top of JavaScript, but this script uses
 *    require() (CommonJS) which disables some type checking. For full TS types,
 *    you'd use import/export with type annotations.
 * 
 * 4. ENVIRONMENT VARIABLES
 *    Java:  System.getenv("DATABASE_URL")
 *    TS:    process.env.DATABASE_URL
 * 
 * 5. ASYNC / AWAIT
 *    Java:  CompletableFuture.supplyAsync(() -> ...).thenApply(...)
 *    TS:    await client.query(sql)       (non-blocking, like Java CompletableFuture)
 *    The 'async' keyword marks a function that returns a Promise.
 *    'await' pauses execution until the Promise resolves (like .get() but non-blocking).
 * 
 * 6. DATABASE CONNECTION
 *    Java:  DataSource → Connection → PreparedStatement → executeUpdate()
 *    TS:    Pool → Client → query()       (pg package)
 *    Pool is like a Java DataSource (connection pool).
 *    Client is like a Java Connection (single database session).
 * 
 * 7. PATH HANDLING
 *    Java:  Paths.get(".").toAbsolutePath()
 *    TS:    __dirname  (directory of current file, like Java's class location)
 *           resolve()  (like java.nio.file.Paths.get().resolve())
 * 
 * 8. STRING INTERPOLATION
 *    Java:  "Hello " + name
 *    TS:    `Hello ${name}`   (template literals with backticks)
 * ============================================================================

// ============================================================================
// IMPORTS (Node.js CommonJS style, like Java import statements)
// ============================================================================

/**
 * 'pg' is the PostgreSQL client for Node.js.
 * Java equivalent: org.postgresql.Driver + a connection pool library (HikariCP)
 * 
 * Pool = Connection pool (like HikariDataSource)
 * Client = Single connection (like java.sql.Connection)
 */
const { Pool } = require('pg')

/**
 * 'fs' = File System module (like java.nio.file.Files)
 * readFileSync = Read file synchronously (blocks until done, like Files.readAllBytes)
 */
const { readFileSync } = require('fs')

/**
 * 'path' = Path manipulation utilities (like java.nio.file.Paths)
 * resolve = Convert relative path to absolute path
 * dirname = Get directory name from a file path
 */
const { resolve, dirname } = require('path')

// ============================================================================
// CONFIGURATION (like Java constants or application.properties)
// ============================================================================

/**
 * __dirname is a Node.js global variable = directory of the current file.
 * Java equivalent: new File(getClass().getProtectionDomain().getCodeSource().getLocation()).getParent()
 * 
 * We resolve the path to sql/schema.sql relative to this script's location.
 * This script is at: apps/backend/src/scripts/import-sql.ts
 * schema.sql is at:  apps/backend/sql/schema.sql
 * So we go up two levels (../../) from scripts/ to backend/, then into sql/.
 */
const SCHEMA_FILE = resolve(__dirname, '../../sql/schema.sql')

/**
 * DATABASE_URL — PostgreSQL connection string.
 * process.env reads environment variables (like System.getenv()).
 * We provide a fallback default for local development.
 * 
 * Java equivalent:
 *   String url = System.getenv("DATABASE_URL");
 *   if (url == null) url = "postgres://postgres:postgres@localhost:5432/pawnpawn_db";
 */
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/pawnpawn_db'

// ============================================================================
// SQL PARSER
// ============================================================================

/**
 * parseSQLStatements — Splits a SQL file into individual statements.
 * 
 * WHY CUSTOM PARSING?
 *   - A simple .split(';') would break on semicolons inside PL/pgSQL blocks
 *     (DO $$ ... $$ statements contain semicolons that are NOT statement
 *      terminators).
 *   - We track whether we're inside a $$ ... $$ dollar-quoted string and only
 *     split on semicolons when outside those blocks.
 * 
 * Java equivalent: A custom SQL script parser that handles dollar-quoted
 * strings (PostgreSQL-specific) before splitting on statement terminators.
 *
 * @param sql - The full SQL file contents as a string
 * @returns Array of individual SQL statements (trimmed, non-empty)
 */
function parseSQLStatements(sql: string): string[] {
  // Remove single-line comments (lines starting with --)
  // Java equivalent: sql.replaceAll("--.*$", "") with MULTILINE mode
  let withoutComments = sql.replace(/--.*$/gm, '')

  const statements: string[] = []      // Array to collect parsed statements (like ArrayList<String>)
  let current = ''           // Current statement being built (like StringBuilder)
  let inDollar = false       // Flag: are we inside a $$ ... $$ block?
  let dollarTag = ''         // The dollar tag (e.g., "$$" or "$tag$")
  
  // Iterate through each character (like Java for(char c : sql.toCharArray()))
  for (let i = 0; i < withoutComments.length; i++) {
    const char = withoutComments[i]
    const nextChar = withoutComments[i + 1]
    
    // ------------------------------------------------------------------------
    // Detect dollar-quote START: $$ or $tag$
    // PostgreSQL uses dollar-quoting for PL/pgSQL blocks (DO $$ ... $$)
    // We must not split on semicolons inside these blocks.
    // ------------------------------------------------------------------------
    if (!inDollar && char === '$') {
      const rest = withoutComments.substring(i)
      const dollarMatch = rest.match(/^(\$\w*\$)/)
      if (dollarMatch) {
        inDollar = true
        dollarTag = dollarMatch[1]     // Save the tag (e.g., "$$") to match the end
        current += dollarTag
        i += dollarTag.length - 1      // Skip past the tag in the loop
        continue
      }
    }
    
    // ------------------------------------------------------------------------
    // Detect dollar-quote END: matching closing tag
    // ------------------------------------------------------------------------
    if (inDollar && char === '$') {
      const rest = withoutComments.substring(i)
      if (rest.startsWith(dollarTag)) {
        inDollar = false
        current += dollarTag
        i += dollarTag.length - 1
        continue
      }
    }
    
    // ------------------------------------------------------------------------
    // Split on semicolon ONLY when NOT inside a dollar-quoted string
    // ------------------------------------------------------------------------
    if (!inDollar && char === ';') {
      const trimmed = current.trim()
      if (trimmed.length > 0 && !trimmed.startsWith('--')) {
        statements.push(trimmed)   // Add completed statement to list
      }
      current = ''                 // Reset for next statement
      continue
    }
    
    // Accumulate character into current statement
    current += char
  }
  
  // Add the last statement if there's remaining content (no trailing semicolon)
  const trimmed = current.trim()
  if (trimmed.length > 0 && !trimmed.startsWith('--')) {
    statements.push(trimmed)
  }
  
  return statements
}

// ============================================================================
// MAIN IMPORT FUNCTION
// ============================================================================

/**
 * importSchema — Main function that reads schema.sql and executes all statements.
 * 
 * This is an async function (returns a Promise), meaning it uses non-blocking I/O.
 * Java equivalent: A method returning CompletableFuture<Void> or using @Async.
 * 
 * The 'await' keyword pauses execution at each await point until the Promise
 * resolves, but does NOT block the Node.js event loop (unlike Thread.sleep()).
 */
async function importSchema() {
  console.log('🚀 Starting SQL schema import...')
  console.log(`📄 Schema file: ${SCHEMA_FILE}`)
  
  // Hide password in log output (replace user:pass@ with ***:***@)
  // Java equivalent: masking sensitive data before logging
  console.log(`🔗 Database: ${DATABASE_URL.replace(/\/\/.*@/, '//***:***@')}`)

  // ----------------------------------------------------------------
  // Step 1: Read the SQL schema file from disk
  // ----------------------------------------------------------------
  // readFileSync reads the entire file into memory synchronously.
  // Java equivalent: Files.readAllBytes(Paths.get(SCHEMA_FILE))
  let schemaSQL
  try {
    schemaSQL = readFileSync(SCHEMA_FILE, 'utf-8')
    console.log(`✅ Loaded schema file (${schemaSQL.length} characters)`)
  } catch (error) {
    console.error(`❌ Failed to read schema file: ${error}`)
    process.exit(1)   // Java equivalent: System.exit(1)
  }

  // ----------------------------------------------------------------
  // Step 2: Parse the SQL file into individual statements
  // ----------------------------------------------------------------
  const statements = parseSQLStatements(schemaSQL)
  console.log(`📋 Found ${statements.length} SQL statements to execute`)

  // ----------------------------------------------------------------
  // Step 3: Create a PostgreSQL connection pool
  // ----------------------------------------------------------------
  // Pool is like Java's HikariDataSource — manages a pool of connections.
  // max: 1 means we only use one connection (schema import is sequential).
  // Java equivalent: HikariConfig.setMaximumPoolSize(1)
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 1, // Single connection for schema import
  })

  // Get a single client connection from the pool
  // Java equivalent: dataSource.getConnection()
  const client = await pool.connect()

  // Counters for import summary
  let successCount = 0   // Statements executed successfully
  let skipCount = 0      // Statements skipped (already exist — idempotent)
  let errorCount = 0     // Statements that failed with real errors

  // ----------------------------------------------------------------
  // Step 4: Execute each SQL statement
  // ----------------------------------------------------------------
  // Java equivalent: for (String sql : statements) { stmt.execute(sql); }
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]

    // Skip empty statements
    if (!statement.trim()) {
      continue
    }

    // Log progress for DDL statements (CREATE, ALTER, DROP)
    // Java equivalent: logging with slf4j/Lombok @Slf4j
    const preview = statement.substring(0, 80).replace(/\s+/g, ' ')
    const isDDL = /^\s*(CREATE|ALTER|DROP)\s+/i.test(statement)

    if (isDDL) {
      console.log(`  [${i + 1}/${statements.length}] ${preview}...`)
    }

    try {
      // Execute the SQL statement
      // Java equivalent: statement.executeUpdate(sql) or statement.execute(sql)
      await client.query(statement)
      successCount++
    } catch (error) {
      errorCount++
      const errorMessage = error.message || String(error)
      
      // Check if this is a "already exists" error (idempotent — safe to skip)
      // Java equivalent: catching SQLException and checking SQLState or error code
      const isDuplicateError =
        errorMessage.includes('already exists') ||
        errorMessage.includes('duplicate key') ||
        (errorMessage.includes('relation') && errorMessage.includes('already exists')) ||
        (errorMessage.includes('type') && errorMessage.includes('already exists'))

      if (isDuplicateError) {
        // Idempotent: table/enum/column already exists, skip gracefully
        console.log(`  ⏭️  Skipped (already exists): ${preview}...`)
        skipCount++
      } else {
        // Real error — log it but continue with other statements
        console.error(`  ❌ Error executing statement ${i + 1}:`)
        console.error(`     ${errorMessage}`)
        console.error(`     Statement: ${preview}...`)
      }
    }
  }

  // ----------------------------------------------------------------
  // Step 5: Print summary
  // ----------------------------------------------------------------
  console.log('\n📊 Import Summary:')
  console.log(`   ✅ Executed: ${successCount}`)
  console.log(`   ⏭️  Skipped:  ${skipCount}`)
  console.log(`   ❌ Errors:   ${errorCount}`)
  console.log(`   📝 Total:    ${statements.length}`)

  if (successCount > 0 || skipCount > 0) {
    console.log('\n🎉 Schema import completed successfully!')
  } else {
    console.log('\n⚠️  No statements executed. Check database connection and schema file.')
  }

  // ----------------------------------------------------------------
  // Step 6: Clean up connections
  // ----------------------------------------------------------------
  // client.release() returns the connection to the pool
  // Java equivalent: connection.close() (returns to pool)
  client.release()
  
  // pool.end() shuts down the pool and all connections
  // Java equivalent: dataSource.close() or HikariDataSource.close()
  await pool.end()
}

// ============================================================================
// SCRIPT ENTRY POINT
// ============================================================================

/**
 * Run importSchema() if this file is executed directly.
 * 
 * Java equivalent: public static void main(String[] args) { ... }
 * 
 * .catch() handles any unhandled promise rejection (like Java's catch block
 * for the main method).
 * process.exit(1) terminates the process with error code (like System.exit(1)).
 */
importSchema().catch((error) => {
  console.error('💥 Fatal error:', error)
  process.exit(1)
})