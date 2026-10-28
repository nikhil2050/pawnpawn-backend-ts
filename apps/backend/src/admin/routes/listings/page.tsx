import { Navigate } from "react-router-dom"

// Compatibility route only: all Listing governance now lives in Products.
const ListingsRedirect = () => <Navigate to="/products" replace />

export default ListingsRedirect
