const { pgTable, serial, text, varchar, boolean, timestamp, integer } = require('drizzle-orm/pg-core');

// Users table (for providers who subscribe)
const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  email: varchar('email', { length: 100 }).notNull(),
  fullName: varchar('full_name', { length: 100 }),
  companyName: varchar('company_name', { length: 100 }),
  phoneNumber: varchar('phone_number', { length: 20 }),
  subscriptionLevel: varchar('subscription_level', { length: 20 }).default('free'),
  createdAt: timestamp('created_at').defaultNow(),
  isAdmin: boolean('is_admin').default(false)
});

// Care seekers (people looking for home healthcare)
const careRequests = pgTable('care_requests', {
  id: serial('id').primaryKey(),
  patientName: varchar('patient_name', { length: 100 }).notNull(),
  contactName: varchar('contact_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 100 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 20 }).notNull(),
  address: text('address'),
  city: varchar('city', { length: 50 }),
  state: varchar('state', { length: 20 }),
  zipCode: varchar('zip_code', { length: 10 }),
  careType: varchar('care_type', { length: 50 }),
  careDetails: text('care_details'),
  careHours: varchar('care_hours', { length: 50 }),
  urgency: varchar('urgency', { length: 20 }),
  status: varchar('status', { length: 20 }).default('new'),
  createdAt: timestamp('created_at').defaultNow(),
  claimedBy: integer('claimed_by').references(() => users.id)
});

// Subscription plans
const subscriptionPlans = pgTable('subscription_plans', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  description: text('description'),
  price: integer('price').notNull(), // in cents
  maxLeads: integer('max_leads').default(0),
  features: text('features'),
  isActive: boolean('is_active').default(true)
});

module.exports = {
  users,
  careRequests,
  subscriptionPlans
};