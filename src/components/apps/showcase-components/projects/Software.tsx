import React from 'react';

// import saga from '../../../assets/pictures/projects/software/saga.mp4';

// import computer from '../../../assets/pictures/projects/software/computer.mp4';

// import scroll from '../../../assets/pictures/projects/software/scroll.mp4';
import CvDownload from '../CvDownload.tsx';
import BackArrow from "../../../general/BackArrow.tsx";

export interface SoftwareProjectsProps {}

const SoftwareProjects: React.FC<SoftwareProjectsProps> = () => {
    return (
        <div className="site-page-content">
            <BackArrow/>
            <h1>Software</h1>
            <h3>Projects</h3>
            <br />
            <p>
                Below are some of my favorite software projects I have worked on
                over the last few years.
            </p>
            <br />
            <CvDownload />
            <br />
            <div className="text-block">
                <h2>1. Personal Webpage</h2>
                <br />
                <p>
                mixiosk.com is my personal portfolio website—and the one you're currently browsing.
                I built this platform to showcase my work in a way that's both interactive and reflective of my technical and creative abilities.
                The idea for the site came to me in early 2024, and I began development shortly after.
                Since then, it has evolved alongside my personal and professional growth, becoming a central hub for my projects, skills, and interests.
                </p>
                <br />
                <h3>Links:</h3>
                <ul>
                    <li>
                        <a
                            rel="noreferrer"
                            target="_blank"
                            href="https://henryheffernan.com"
                        >
                            <p>
                                <b>[Portfolio Webpage]</b> - mixiosk.com
                            </p>
                        </a>
                    </li>
                    <li>
                        <a
                            rel="noreferrer"
                            target="_blank"
                            href="https://github.com/iammix/mixi-os"
                        >
                            <p>
                                <b>[GitHub]</b> - mixiosk.com Repository
                            </p>
                        </a>
                    </li>
                </ul>
                <h2>2. mixi-os Terminal</h2>
                <br />
                <p>
                mixios-terminal is a web-based terminal emulator designed to replicate the look and feel of a traditional Unix-like terminal within a browser environment.
                It offers users an interactive interface to execute predefined commands, making it ideal for demonstrations, or personal projects.
                </p>
                <br />
                <h3>Links:</h3>
                <ul>
                    <li>
                        <a
                            rel="noreferrer"
                            target="_blank"
                            href="https://github.com/iammix/mixios-terminal"
                        >
                            <p>
                                <b>[GitHub]</b> - mixi-os Terminal Repository
                            </p>
                        </a>
                    </li>
                </ul>

                <h2>3. InclusionPy</h2>
                <br />
                <p>
                InclusionsPy is a Python library designed for performing inclusion calculations pertinent to structural and geotechnical engineering problems. 
                This tool aids engineers and researchers in analyzing and modeling inclusions within various materials and soil structures.
                </p>
                <br />
                <h3>Links:</h3>
                <ul>
                    <li>
                        <a
                            rel="noreferrer"
                            target="_blank"
                            href="https://github.com/iammix/InclusionsPy"
                        >
                            <p>
                                <b>[GitHub]</b> - InclusionPy Repository
                            </p>
                        </a>
                    </li>
                </ul>

                <h2>4. AnySectionPy</h2>
                <br />
                <p>
                AnySection is a Python library for reinforced concrete section analysis.
                It provides tools for modeling, analyzing, and visualizing the structural behavior of reinforced concrete sections using material nonlinearities and fiber-based analysis methods.
                </p>
                <br />
                <h3>Links:</h3>
                <ul>
                    <li>
                        <a
                            rel="noreferrer"
                            target="_blank"
                            href="https://github.com/iammix/AnySection"
                        >
                            <p>
                                <b>[GitHub]</b> - AnySectionPy Repository
                            </p>
                        </a>
                    </li>
                </ul>


                <h2>5. rise-database</h2>
                <br />
                <p>
                The RiseDatabase Python library provides tools to download, process, and visualize accelerometer datasets collected from structural monitoring systems. 
                The library interacts with a Flask-based API backend to securely fetch datasets stored in a private Google Drive repository. 
                It includes features for downloading datasets, applying baseline correction to signals, and plotting time-series accelerometer data.
                </p>
                <br />
                <h3>Links:</h3>
                <ul>
                    <li>
                        <a
                            rel="noreferrer"
                            target="_blank"
                            href="https://github.com/iammix/AnySection"
                        >
                            <p>
                                <b>[GitHub]</b> - rise-database Repository
                            </p>
                        </a>
                    </li>
                </ul>

                <h2>6. calenmix</h2>
                <br />
                <p>
                Calenmix is a web-based meeting booking application designed to streamline the scheduling process. 
                Built with modern web technologies, it offers users an intuitive interface to manage and coordinate meetings efficiently.
                </p>
                <br />
                <h3>Links:</h3>
                <ul>
                    <li>
                        <a
                            rel="noreferrer"
                            target="_blank"
                            href="https://github.com/iammix/calenmix"
                        >
                            <p>
                                <b>[GitHub]</b> - calenmix Repository
                            </p>
                        </a>
                    </li>
                </ul>


                <h2>7. biaxialPy</h2>
                <br />
                <p>
                biaxialPy is a Python library designed for analyzing biaxial loads on concrete sections.
                It provides tools for engineers and researchers to assess and visualize the behavior of concrete sections under combined axial and biaxial bending moments.
                </p>
                <br />
                <h3>Links:</h3>
                <ul>
                    <li>
                        <a
                            rel="noreferrer"
                            target="_blank"
                            href="https://github.com/iammix/biaxialPy"
                        >
                            <p>
                                <b>[GitHub]</b> - biaxialPy Repository
                            </p>
                        </a>
                    </li>
                </ul>


                <h2>8. lesa: Lightweight Elastic Structural Analysis</h2>
                <br />
                <p>
                lesa is a Python library designed for performing lightweight elastic structural analysis.
                It provides tools for engineers and researchers to analyze and model the elastic behavior of structures efficiently.
                </p>
                <br />
                <h3>Links:</h3>
                <ul>
                    <li>
                        <a
                            rel="noreferrer"
                            target="_blank"
                            href="https://github.com/iammix/lesa"
                        >
                            <p>
                                <b>[GitHub]</b> - lesa Repository
                            </p>
                        </a>
                    </li>
                </ul>

                <h2>9. XFEMPy</h2>
                <br />
                <p>
                XFEMPy is a Python package designed to solve fracture problems in 2D linear-elastic solids using the Extended Finite Element Method (XFEM).
                It provides tools for engineers and researchers to model and analyze crack propagation without the need for mesh refinement around discontinuities.
                </p>
                <br />
                <h3>Links:</h3>
                <ul>
                    <li>
                        <a
                            rel="noreferrer"
                            target="_blank"
                            href="https://github.com/iammix/XFEMPy"
                        >
                            <p>
                                <b>[GitHub]</b> - XFEMPy Repository
                            </p>
                        </a>
                    </li>
                </ul>


                <h2>10. GID+OpenSees</h2>
                <br />
                <p>
                The GiD+OpenSees Interface is an integration tool that combines the graphical pre/post-processing capabilities of GiD with the computational power of OpenSees. 
                Developed by the Lab of R/C and Masonry Structures at the School of Civil Engineering, Aristotle University of Thessaloniki, this interface provides a user-friendly environment for finite element analysis in structural engineering.
                I developed the part of the code that connects the interface with the OpenSeesPy library.
                </p>
                <br />
                <h3>Links:</h3>
                <ul>
                    <li>
                        <a
                            rel="noreferrer"
                            target="_blank"
                            href="https://github.com/rclab-auth/gidopensees"
                        >
                            <p>
                                <b>[GitHub]</b> - GID+OpenSees Repository
                            </p>
                        </a>
                    </li>
                </ul>


                <h2>11. OpenSeesTcl2Py</h2>
                <br />
                <p>
                OpenSeesTcl2Py is a Python tool designed to facilitate the conversion of OpenSees scripts written in Tcl to Python scripts compatible with OpenSeesPy.
                This conversion enables engineers and researchers to leverage Python's extensive ecosystem while utilizing OpenSees for structural analysis.
                </p>
                <br />
                <h3>Links:</h3>
                <ul>
                    <li>
                        <a
                            rel="noreferrer"
                            target="_blank"
                            href="https://github.com/iammix/OpenSeesTcl2Py"
                        >
                            <p>
                                <b>[GitHub]</b> - OpenSeesTcl2Py Repository
                            </p>
                        </a>
                    </li>
                </ul>

                <h2>12. IFCexport</h2>
                <br />
                <p>
                IFCexportPy is a Python library designed to facilitate the export of Building Information Modeling (BIM) data to Industry Foundation Classes (IFC) files.
                It enables seamless conversion of BIM models into the IFC format, promoting interoperability across various BIM software platforms.
                </p>
                <br />
                <h3>Links:</h3>
                <ul>
                    <li>
                        <a
                            rel="noreferrer"
                            target="_blank"
                            href="https://github.com/iammix/IFCexportPy"
                        >
                            <p>
                                <b>[GitHub]</b> - IFCexport Repository
                            </p>
                        </a>
                    </li>
                </ul>

                <h2>13. OpenSeesPy Sub-Stepping Methods</h2>
                <br />
                <p>
                OpenSeesPy Sub-Stepping Methods is a Python package designed to enhance the efficiency of structural analyses performed using OpenSeesPy.
                By implementing sub-stepping techniques for both load and displacement control analyses, this package facilitates the handling of large and complex structural systems.
                </p>
                <br />
                <h3>Links:</h3>
                <ul>
                    <li>
                        <a
                            rel="noreferrer"
                            target="_blank"
                            href="https://github.com/iammix/OpenSeesPy-Substepping-Methods"
                        >
                            <p>
                                <b>[GitHub]</b> - OpenSeesPy Sub-Stepping Methods Repository
                            </p>
                        </a>
                    </li>
                </ul>



                <p>Beyond my own repositories, I am also an active open-source contributor in collaborative projects across research and industry. These include: 
                    <br/>
                     <a href="https://github.com/carla-simulator/carla">carla-simulator/carla</a>,
                     <br/>
                     <a href="https://github.com/craftzdog/dotfiles-public">craftzdog/dotfiles-public</a>,
                     <br/>
                    <a href="https://github.com/alstr/todo-to-issue-action">alstr/todo-to-issue-action</a>,
                    <br/>
                    <a href="https://github.com/NREL/graph-env">NREL/graph-env</a>
                </p>
            </div>

            <CvDownload />
        </div>
    );
};
interface StyleSheetCSS {
    [key: string]: React.CSSProperties;
}
const styles: StyleSheetCSS = {
    video: {
        width: '100%',
        padding: 12,
    },
    caption: {
        width: '80%',
    },
};

export default SoftwareProjects;