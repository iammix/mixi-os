import './App.css';
// eslint-disable-next-line no-unused-vars
//import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom'

//import Showcase from "./components/apps/Showcase";

//import NavBar from './components/apps/showcase-components/NavBar';

import Desktop from './components/os/Desktop';

function App() {
    return (
        <Router>
            <Desktop/>
        </Router>
    )
}

export default App
