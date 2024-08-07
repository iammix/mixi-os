import './App.css';
import Desktop from './components/os/Desktop';
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'

import Contact from "./components/apps/showcase-components/Contact";
import About from "./components/apps/showcase-components/About";
import Showcase from "./components/apps/Showcase";
import Home from "./components/apps/showcase-components/Home";
import PostGrid from './components/apps/showcase-components/PostGrid';

function App() {
    return (
        <Router>
            <div className='site-page'>
                <Routes>
                    <Route path='/' element={<Home/>}/>
                    <Route path='/about' element={<About/>}/>
                    <Route path='/contact' element={<Contact/>}/>
                    <Route path='/blogposts' element={<PostGrid/>}/>
                </Routes>
            </div>
        </Router>
    )
}

export default App
