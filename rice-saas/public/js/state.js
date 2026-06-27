// ═══════════════════════════════════════════════════════
// state.js — Global state variables and constants
// ═══════════════════════════════════════════════════════

let bags = [], sales = [], orders = [], customers = [], users = [], openedBags = [];
let settings = { shopName: 'Rice Shop', waNumber: '', city: 'Tuni', deliveryCharge: 0 };
let editingBagId = null, editingOrderId = null, editingCustId = null;
let uploadedImg = '';
let salesFilter = 'all', orderFilter = 'all', profitFilter = 'month';
let currentUser = null, currentUserData = null;
let sendMsgType = 'morning';
let unsubBags, unsubSales, unsubOrders, unsubCustomers, unsubUsers, unsubShopInfo;
let currentInvoiceSale = null;
let openingBagId = null;
let looseSaleBagId = null, looseOpenBagId = null;

// ALL PERMISSIONS with labels — note: these are now per-shop, stored at
// shops/{shopId}/users/{uid}.permissions
const ALL_PERMS = {
  stock:             'View Stock',
  addEditBag:        'Add/Edit Bags',
  deleteBag:         'Delete Bags',
  sales:             'View Sales',
  record:            'Record Sale',
  orders:            'View Orders',
  addOrder:          'Add Orders',
  updateOrder:       'Update Order Status',
  whatsapp:          'WhatsApp Tab',
  customers:         'View Customers',
  addCustomer:       'Add Customers',
  viewRevenue:       'View Revenue Metrics',
  viewProfitMetrics: 'View Profit Metrics',
  profit:            'View Profit/Cost',
  billing:           'View/Manage Billing',
  settings:          'Settings',
  permissions:       'Permissions (Shop Owner only)',
};
