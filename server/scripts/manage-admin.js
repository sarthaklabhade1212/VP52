/**
 * VP52 Administrative Account Management CLI
 * 
 * Provides safe, non-destructive administrative account management:
 * - List existing admin accounts (metadata only, never hashes)
 * - Create new admin accounts with password validation
 * - Reset admin passwords safely
 * - Upsert (create or update) admin accounts
 * 
 * DOES NOT touch customer data, wallets, coins, transactions, or merchant accounts.
 * 
 * Usage:
 *   node server/scripts/manage-admin.js list
 *   node server/scripts/manage-admin.js create <email> [password] [full_name]
 *   node server/scripts/manage-admin.js reset-password <email> [new_password]
 *   node server/scripts/manage-admin.js upsert <email> [password] [full_name]
 */

const path = require('path');
require('dotenv').config({
  path: path.join(__dirname, '..', '.env')
});

const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { validatePasswordStrength, generateStrongPassword } = require('../utils/password');

function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

function listAdmins() {
  const admins = db.prepare('SELECT id, full_name, email, created_at FROM admins ORDER BY id ASC').all();
  console.log('\n====================================================');
  console.log(`🛡️  VP52 Registered Administrators (${admins.length}):`);
  console.log('====================================================');
  if (admins.length === 0) {
    console.log('  (No admin accounts found in database)');
  } else {
    admins.forEach((admin) => {
      console.log(`  [ID: ${admin.id}] ${admin.full_name} <${admin.email}> (Created: ${admin.created_at})`);
    });
  }
  console.log('====================================================\n');
  return admins;
}

function createOrResetAdmin({ email, password, fullName, mode = 'upsert' }) {
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail || !cleanEmail.includes('@')) {
    console.error('❌ Error: A valid email address is required.');
    process.exit(1);
  }

  // Role isolation check: prevent creating admin with existing customer or shop email
  const customerConflict = db.prepare('SELECT id, full_name FROM users WHERE LOWER(email) = ?').get(cleanEmail);
  if (customerConflict) {
    console.error(`❌ Error: Email "${cleanEmail}" is already registered to customer "${customerConflict.full_name}" (User ID: ${customerConflict.id}).`);
    console.error('   Role isolation requires distinct emails for customer and admin accounts.');
    process.exit(1);
  }

  const shopConflict = db.prepare('SELECT id, name FROM shops WHERE LOWER(email) = ?').get(cleanEmail);
  if (shopConflict) {
    console.error(`❌ Error: Email "${cleanEmail}" is already registered to merchant shop "${shopConflict.name}" (Shop ID: ${shopConflict.id}).`);
    console.error('   Role isolation requires distinct emails for merchant and admin accounts.');
    process.exit(1);
  }

  // Check if admin exists
  const existingAdmin = db.prepare('SELECT id, full_name, email FROM admins WHERE LOWER(email) = ?').get(cleanEmail);

  if (mode === 'create' && existingAdmin) {
    console.error(`❌ Error: Admin account with email "${cleanEmail}" already exists (ID: ${existingAdmin.id}).`);
    console.error('   Use "reset-password" or "upsert" to update the existing admin.');
    process.exit(1);
  }

  if (mode === 'reset' && !existingAdmin) {
    console.error(`❌ Error: No admin account found with email "${cleanEmail}".`);
    console.error('   Use "create" or "upsert" to create a new admin.');
    process.exit(1);
  }

  // Handle password
  let plainPassword = password || process.env.ADMIN_PASSWORD;
  let wasGenerated = false;

  if (!plainPassword) {
    plainPassword = generateStrongPassword(16);
    wasGenerated = true;
  }

  // Validate password strength
  const strength = validatePasswordStrength(plainPassword);
  if (!strength.ok) {
    console.error(`❌ Error: Password does not meet security requirements: ${strength.error}`);
    process.exit(1);
  }

  const passwordHash = bcrypt.hashSync(plainPassword, 12);
  const adminName = fullName || (existingAdmin ? existingAdmin.full_name : 'VP52 Administrator');

  if (existingAdmin) {
    db.prepare(`
      UPDATE admins 
      SET password_hash = ?, full_name = ?
      WHERE id = ?
    `).run(passwordHash, adminName, existingAdmin.id);

    console.log('\n====================================================');
    console.log(`✅ Admin Password Successfully Updated:`);
    console.log(`   ID:        ${existingAdmin.id}`);
    console.log(`   Name:      ${adminName}`);
    console.log(`   Email:     ${cleanEmail}`);
    if (wasGenerated) {
      console.log(`   Temporary Password: ${plainPassword}`);
      console.log('   ⚠️  Store this password securely. It will not be shown again.');
    } else {
      console.log('   Password:  (Set from argument / environment variable)');
    }
    console.log('====================================================\n');

    return {
      success: true,
      action: 'updated',
      id: existingAdmin.id,
      email: cleanEmail,
      full_name: adminName,
      generatedPassword: wasGenerated ? plainPassword : null
    };
  } else {
    const result = db.prepare(`
      INSERT INTO admins (full_name, email, password_hash)
      VALUES (?, ?, ?)
    `).run(adminName, cleanEmail, passwordHash);

    console.log('\n====================================================');
    console.log(`✅ New Admin Account Successfully Created:`);
    console.log(`   ID:        ${result.lastInsertRowid}`);
    console.log(`   Name:      ${adminName}`);
    console.log(`   Email:     ${cleanEmail}`);
    if (wasGenerated) {
      console.log(`   Initial Password: ${plainPassword}`);
      console.log('   ⚠️  Store this password securely. It will not be shown again.');
    } else {
      console.log('   Password:  (Set from argument / environment variable)');
    }
    console.log('====================================================\n');

    return {
      success: true,
      action: 'created',
      id: result.lastInsertRowid,
      email: cleanEmail,
      full_name: adminName,
      generatedPassword: wasGenerated ? plainPassword : null
    };
  }
}

// CLI Execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] ? args[0].toLowerCase() : 'help';

  switch (command) {
    case 'list':
      listAdmins();
      break;

    case 'create':
      if (!args[1]) {
        console.error('Usage: node server/scripts/manage-admin.js create <email> [password] [full_name]');
        process.exit(1);
      }
      createOrResetAdmin({
        email: args[1],
        password: args[2],
        fullName: args[3],
        mode: 'create'
      });
      break;

    case 'reset-password':
    case 'reset':
      if (!args[1]) {
        console.error('Usage: node server/scripts/manage-admin.js reset-password <email> [new_password]');
        process.exit(1);
      }
      createOrResetAdmin({
        email: args[1],
        password: args[2],
        fullName: args[3],
        mode: 'reset'
      });
      break;

    case 'upsert':
      if (!args[1]) {
        console.error('Usage: node server/scripts/manage-admin.js upsert <email> [password] [full_name]');
        process.exit(1);
      }
      createOrResetAdmin({
        email: args[1],
        password: args[2],
        fullName: args[3],
        mode: 'upsert'
      });
      break;

    case 'help':
    default:
      console.log('\nVP52 Admin Management Tool');
      console.log('---------------------------');
      console.log('Commands:');
      console.log('  list                                         List all administrator accounts');
      console.log('  create <email> [password] [full_name]        Create a new admin account');
      console.log('  reset-password <email> [new_password]        Reset password for existing admin');
      console.log('  upsert <email> [password] [full_name]        Create or update admin account');
      console.log('\nIf password is not provided, a cryptographically secure 16-character password is generated.\n');
      break;
  }
}

module.exports = {
  listAdmins,
  createOrResetAdmin
};
