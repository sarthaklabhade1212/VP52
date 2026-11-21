/**
 * VP52 MASTER CATEGORY SYSTEM (Client ESM)
 * Complete 17 Categories & 256 Subcategories
 * Single source of truth for frontend categorization, icons, filtering and search.
 */

export const CATEGORIES = [
  {
    id: 'grocery-food-stores',
    name: 'Grocery & Food Stores',
    icon: 'ShoppingBag',
    catalogType: 'grocery',
    color: '#10b981',
    description: 'Fresh groceries, dairy, baked goods, daily essentials and organic food stores.',
    subcategories: [
      'Grocery Store',
      'Supermarket',
      'General Store',
      'Dairy Shop',
      'Milk Center',
      'Bakery',
      'Sweet Shop',
      'Namkeen Shop',
      'Dry Fruits Shop',
      'Fruits Shop',
      'Vegetable Shop',
      'Chicken Shop',
      'Mutton Shop',
      'Fish Shop',
      'Ice Cream Parlour',
      'Mineral Water Shop'
    ]
  },
  {
    id: 'hotels-food-services',
    name: 'Hotels & Food Services',
    icon: 'UtensilsCrossed',
    catalogType: 'restaurant',
    color: '#f59e0b',
    description: 'Restaurants, dhabas, cafes, fast food, sweets, breakfast and catering.',
    subcategories: [
      'Restaurant',
      'Pure Veg Restaurant',
      'Non-Veg Restaurant',
      'Dhaba',
      'Tea Center',
      'Coffee Shop',
      'Juice Center',
      'Fast Food Center',
      'Pizza Shop',
      'Burger Shop',
      'Vadapav Center',
      'Breakfast Center',
      'Sweet Mart',
      'Catering Services',
      'Food Delivery'
    ]
  },
  {
    id: 'electrical-electronics',
    name: 'Electrical & Electronics',
    icon: 'Zap',
    catalogType: 'electronics',
    color: '#3b82f6',
    description: 'Electronics, mobile sales & repair, appliances, solar, inverters and CCTV.',
    subcategories: [
      'Electrical Shop',
      'Electronics Shop',
      'Mobile Shop',
      'Mobile Repairing',
      'Computer Shop',
      'Laptop Repairing',
      'TV Repairing',
      'Refrigerator Repairing',
      'AC Repairing',
      'CCTV Services',
      'Solar System Shop',
      'Inverter & Battery Shop',
      'Electrical Contractor'
    ]
  },
  {
    id: 'clothing-fashion',
    name: 'Clothing & Fashion',
    icon: 'Shirt',
    catalogType: 'clothing',
    color: '#ec4899',
    description: 'Readymade garments, Paithani sarees, footwear, jewellery, cosmetics and salons.',
    subcategories: [
      'Readymade Garments',
      'Saree Shop',
      'Paithani Saree Shop',
      'Ladies Collection',
      'Gents Collection',
      'Kids Wear',
      'Shoes Shop',
      'Footwear Shop',
      'Bag Shop',
      'Watch Shop',
      'Jewellery Shop',
      'Cosmetics Shop',
      'Beauty Parlour',
      'Salon',
      'Tailoring Shop',
      'Fashion Designer'
    ]
  },
  {
    id: 'medical-healthcare',
    name: 'Medical & Healthcare',
    icon: 'HeartPulse',
    catalogType: 'healthcare',
    color: '#ef4444',
    description: 'Pharmacies, clinics, doctors, diagnostic labs, hospitals and wellness centers.',
    subcategories: [
      'Medical Store',
      'Hospital',
      'Clinic',
      'Doctor',
      'Dental Clinic',
      'Eye Hospital',
      'Pathology Lab',
      'Sonography Center',
      'Physiotherapy Center',
      'Ayurvedic Center',
      'Homeopathy Clinic',
      'Ambulance Service',
      'Health Checkup Center'
    ]
  },
  {
    id: 'automobile-services',
    name: 'Automobile Services',
    icon: 'Car',
    catalogType: 'service',
    color: '#8b5cf6',
    description: 'Showrooms, garages, service centers, tyres, batteries, washing and repairs.',
    subcategories: [
      'Two Wheeler Showroom',
      'Four Wheeler Showroom',
      'Used Car Dealer',
      'Used Bike Dealer',
      'Garage',
      'Car Service Center',
      'Bike Service Center',
      'Tyre Shop',
      'Puncture Shop',
      'Battery Shop',
      'Car Washing Center',
      'Car Decoration',
      'Spare Parts Shop',
      'Tractor Showroom',
      'Tractor Repairing',
      'Petrol Pump',
      'EV Charging Station'
    ]
  },
  {
    id: 'construction-hardware',
    name: 'Construction & Hardware',
    icon: 'Hammer',
    catalogType: 'product',
    color: '#d97706',
    description: 'Building materials, cement, steel, paint, tiles, sanitary, furniture & architects.',
    subcategories: [
      'Hardware Shop',
      'Cement Shop',
      'Steel Shop',
      'Paint Shop',
      'Tiles Shop',
      'Marble Shop',
      'Sanitary Ware Shop',
      'Plumbing Materials',
      'Electrical Materials',
      'Furniture Shop',
      'Timber Shop',
      'Aluminium Work',
      'Glass Work',
      'Interior Designer',
      'Architect',
      'Civil Engineer',
      'Builder & Contractor'
    ]
  },
  {
    id: 'home-services',
    name: 'Home Services',
    icon: 'Wrench',
    catalogType: 'service',
    color: '#06b6d4',
    description: 'Plumbers, electricians, painters, home cleaning, pest control and appliance repair.',
    subcategories: [
      'Plumber',
      'Electrician',
      'Carpenter',
      'Painter',
      'AC Repairing',
      'Refrigerator Repairing',
      'Washing Machine Repairing',
      'Home Cleaning',
      'Sofa Cleaning',
      'Pest Control',
      'Water Purifier Service',
      'CCTV Installation',
      'Home Shifting Service'
    ]
  },
  {
    id: 'education-classes',
    name: 'Education & Classes',
    icon: 'GraduationCap',
    catalogType: 'education',
    color: '#6366f1',
    description: 'Schools, colleges, tuition, competitive exam coaching, language, arts & skills.',
    subcategories: [
      'Play School',
      'Nursery',
      'School',
      'College',
      'Tuition Classes',
      'Competitive Exam Classes',
      'NEET / JEE Classes',
      'English Speaking Classes',
      'Computer Classes',
      'Dance Classes',
      'Music Classes',
      'Drawing Classes',
      'Sports Academy',
      'Driving School',
      'Skill Development Center'
    ]
  },
  {
    id: 'agriculture-farming',
    name: 'Agriculture & Farming',
    icon: 'Tractor',
    catalogType: 'product',
    color: '#84cc16',
    description: 'Seeds, fertilizers, irrigation, tractor services, farms, nursery and veterinary.',
    subcategories: [
      'Agriculture Service Center',
      'Seeds Shop',
      'Fertilizer Shop',
      'Pesticides Shop',
      'Agricultural Medicines',
      'Tractor Sales',
      'Agricultural Equipment',
      'Harvester Service',
      'JCB Service',
      'Water Pump Shop',
      'Drip Irrigation',
      'Sprinkler System',
      'Agriculture Consultant',
      'Plant Nursery',
      'Dairy Farm',
      'Poultry Farm',
      'Goat Farming',
      'Veterinary Doctor',
      'Animal Feed Shop'
    ]
  },
  {
    id: 'travel-transportation',
    name: 'Travel & Transportation',
    icon: 'Truck',
    catalogType: 'service',
    color: '#0284c7',
    description: 'Travel agencies, taxi services, car rentals, transport, movers and courier.',
    subcategories: [
      'Travel Agency',
      'Taxi Service',
      'Car Rental',
      'Bus Booking',
      'Truck Transport',
      'Tempo Service',
      'Packers & Movers',
      'Courier Service',
      'Parcel Delivery',
      'Driver Service',
      'Tours & Travels',
      'Lodging & Hotels'
    ]
  },
  {
    id: 'property-real-estate',
    name: 'Property & Real Estate',
    icon: 'Building2',
    catalogType: 'service',
    color: '#475569',
    description: 'House & flat sales, plot sales, agricultural land, rentals and property consultants.',
    subcategories: [
      'House Buying & Selling',
      'Flat Sales',
      'Plot Sales',
      'Agricultural Land',
      'House on Rent',
      'Shop on Rent',
      'Office Space',
      'Real Estate Agent',
      'Builder',
      'Property Consultant',
      'Interior Designer'
    ]
  },
  {
    id: 'finance-government-services',
    name: 'Finance & Government Services',
    icon: 'Landmark',
    catalogType: 'service',
    color: '#ca8a04',
    description: 'Banking, insurance, CA, GST, PAN, Aadhaar, CSC centers, notary & legal services.',
    subcategories: [
      'Banks',
      'Credit Society',
      'Finance Company',
      'Insurance Agent',
      'LIC Agent',
      'CA Office',
      'Accountant',
      'GST Services',
      'PAN Card Services',
      'Aadhaar Services',
      'Online Form Center',
      'CSC Center',
      'Passport Agent',
      'Government Document Services',
      'Lawyer',
      'Notary',
      'Loan Consultant'
    ]
  },
  {
    id: 'beauty-fitness-personal-care',
    name: 'Beauty, Fitness & Personal Care',
    icon: 'Sparkles',
    catalogType: 'service',
    color: '#e11d48',
    description: 'Gyms, yoga, spas, massage, bridal makeup, mehendi, unisex salons and tattoo artists.',
    subcategories: [
      'Gym',
      'Yoga Center',
      'Fitness Trainer',
      'Zumba Classes',
      'Spa',
      'Massage Center',
      'Beauty Parlour',
      'Makeup Artist',
      'Bridal Makeup',
      'Mehendi Artist',
      'Ladies Salon',
      'Gents Salon',
      'Tattoo Artist'
    ]
  },
  {
    id: 'wedding-event-services',
    name: 'Wedding & Event Services',
    icon: 'PartyPopper',
    catalogType: 'service',
    color: '#c026d3',
    description: 'Marriage halls, lawns, decorators, photographers, DJ, catering and event planners.',
    subcategories: [
      'Marriage Hall',
      'Party Lawn',
      'Banquet Hall',
      'Decoration Services',
      'Florist',
      'Photographer',
      'Videographer',
      'DJ Sound',
      'Lighting Services',
      'Catering Services',
      'Wedding Planner',
      'Event Management',
      'Horse & Buggy Booking',
      'Wedding Wear',
      'Invitation Card Printing'
    ]
  },
  {
    id: 'general-other-shops',
    name: 'General & Other Shops',
    icon: 'Store',
    catalogType: 'product',
    color: '#78716c',
    description: 'Gifts, stationery, books, utensils, sports, printing, laundry and photo studios.',
    subcategories: [
      'Utensils Shop',
      'Gift Shop',
      'Toy Shop',
      'Stationery Shop',
      'Book Shop',
      'Sports Shop',
      'Pooja Material Shop',
      'Agarbatti Shop',
      'Flower Shop',
      'Mattress & Bedding Shop',
      'Curtains & Carpet Shop',
      'Plastic Goods Shop',
      'Xerox Center',
      'Printing Press',
      'Photo Studio',
      'Laundry',
      'Dry Cleaning',
      'Courier Center'
    ]
  },
  {
    id: 'special-services',
    name: 'Special Services',
    icon: 'HandHelping',
    catalogType: 'service',
    color: '#14b8a6',
    description: 'Pet clinics, gardening, security, domestic staff, care services and digital agencies.',
    subcategories: [
      'Pet Shop',
      'Dog Training',
      'Pet Clinic',
      'Gardening Services',
      'Gardener',
      'Security Agency',
      'Labour Contractor',
      'Maid Services',
      'Cook Services',
      'Caretaker Services',
      'Elderly Care Services',
      'NGO & Foundation',
      'Digital Marketing',
      'Website Development',
      'App Development',
      'Social Media Management'
    ]
  }
];

export function getCategoryById(id) {
  if (!id) return null;
  return CATEGORIES.find(c => c.id === id || c.name.toLowerCase() === id.toLowerCase()) || null;
}

export function findCategoryForSubcategory(subcatName) {
  if (!subcatName) return null;
  const target = subcatName.trim().toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.subcategories.some(s => s.toLowerCase() === target)) {
      return cat;
    }
  }
  return null;
}
