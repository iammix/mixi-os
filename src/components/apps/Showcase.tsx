import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import About from "./showcase-components/About.tsx";
import Contact from "./showcase-components/Contact.tsx";
import Home from "./showcase-components/Home.tsx";
import useInitialWindowSize from "../../hooks/useInitialWindowSize.tsx";

interface ShowcaseProps {}

const Showcase: React.FC<ShowcaseProps>=(props) => {
    const {initWidth, initHeight } = useInitialWindowSize({ margin: 100});

    return (
        <Router>
            <div>
                <Routes>
                    <Route path='/' element={<Home/>}/>
                    <Route path="/about" element={<About/>} />
                    <Route path="/contact" element={<Contact/>} />
                </Routes>
            </div>
        </Router>
    );
};

export default Showcase;
