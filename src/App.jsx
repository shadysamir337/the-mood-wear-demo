import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'framer-motion'
import ErrorBoundary from './components/ErrorBoundary'
import StoreLayout from './components/Layout'
import Home from './pages/Home'
import { Shop, Moods, MoodPage } from './pages/Shop'
import Product from './pages/Product'
import { useAuth } from './lib/auth'

// Storefront pages that aren't on the browse path load on demand.
const named = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })))
const content = () => import('./pages/Content')
const checkout = () => import('./pages/Checkout')
const account = () => import('./pages/Account')
const Checkout = named(checkout, 'Checkout')
const OrderDone = named(checkout, 'OrderDone')
const Track = named(checkout, 'Track')
const Story = named(content, 'Story')
const InfoPage = named(content, 'InfoPage')
const NotFound = named(content, 'NotFound')
const Login = named(account, 'Login')
const Account = named(account, 'Account')
const Wishlist = named(account, 'Wishlist')
const Review = named(account, 'Review')

// Admin
const admin = () => import('./admin/AdminLayout')
const marketing = () => import('./admin/Marketing')
const ops = () => import('./admin/Operations')
const AdminLayout = lazy(admin)
const AdminLogin = named(admin, 'AdminLogin')
const Dashboard = lazy(() => import('./admin/Dashboard'))
const Products = lazy(() => import('./admin/Products'))
const AdminMoods = named(marketing, 'Moods')
const Promos = named(marketing, 'Promos')
const Sales = named(marketing, 'Sales')
const Banners = named(marketing, 'Banners')
const Orders = named(ops, 'Orders')
const Inventory = named(ops, 'Inventory')
const Customers = named(ops, 'Customers')
const Settings = named(ops, 'Settings')
const Reviews = named(() => import('./admin/Community'), 'Reviews')
const Activity = named(() => import('./admin/Community'), 'Activity')

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } })

const INFO = ['faq', 'shipping-returns', 'size-guide', 'contact', 'privacy']

export default function App() {
  const init = useAuth((s) => s.init)
  useEffect(() => {
    const unsub = init()
    return () => typeof unsub === 'function' && unsub()
  }, [init])

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          <BrowserRouter>
            <Suspense fallback={<div className="a-loading eyebrow">THE MOOD</div>}>
              <Routes>
                <Route element={<StoreLayout />}>
                  <Route index element={<Home />} />
                  <Route path="shop" element={<Shop />} />
                  <Route path="moods" element={<Moods />} />
                  <Route path="moods/:slug" element={<MoodPage />} />
                  <Route path="product/:slug" element={<Product />} />
                  <Route path="checkout" element={<Checkout />} />
                  <Route path="order/:number" element={<OrderDone />} />
                  <Route path="track" element={<Track />} />
                  <Route path="story" element={<Story />} />
                  <Route path="login" element={<Login />} />
                  <Route path="account" element={<Account />} />
                  <Route path="wishlist" element={<Wishlist />} />
                  <Route path="review/:token" element={<Review />} />
                  <Route path="review/order/:orderId" element={<Review />} />
                  {INFO.map((p) => <Route key={p} path={p} element={<InfoPage page={p} />} />)}
                  <Route path="*" element={<NotFound />} />
                </Route>

                <Route path="admin/login" element={<AdminLogin />} />
                <Route path="admin" element={<AdminLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="orders" element={<Orders />} />
                  <Route path="products" element={<Products />} />
                  <Route path="moods" element={<AdminMoods />} />
                  <Route path="inventory" element={<Inventory />} />
                  <Route path="promos" element={<Promos />} />
                  <Route path="sales" element={<Sales />} />
                  <Route path="banners" element={<Banners />} />
                  <Route path="customers" element={<Customers />} />
                  <Route path="reviews" element={<Reviews />} />
                  <Route path="activity" element={<Activity />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="*" element={<p className="muted">That admin page doesn't exist.</p>} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </MotionConfig>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
