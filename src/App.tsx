import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import MapPage from "./pages/MapPage";
import Analysis from "./pages/Analysis";
import ScrollToTop from "./components/ScrollToTop";
import Sidebar from "./components/Sidebar";

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Sidebar />
      <div className="app-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/analysis" element={<Analysis />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
