import "./NavBar.css"; 
// import Logo from "../public/inbraket-logo.png"

export default function NavBar() {
    return (
        <header className="header">
            <div className="container">
                <nav className="nav">

                    {/* Left side: Logo + Links + Top Bar */}
                    <div className="leftside-div">
                        <div className="logo">
                            <a href="#"><img src="/inbraket-logo.png" alt="logo" /></a>
                        </div>

                        <div className="desktop-links">
                            <a href="#">Workbench</a>
                            <a href="#">Case</a>
                            <a href="#">Patient</a>
                        </div>

                        <div className="top-bar">
                            <button className="top-button">return</button>
                            <select name="" id="" className="top-dropdown">
                                <option value="" selected>yang sang / qa</option>
                            </select>
                            <button className="top-button">share</button>
                        </div>
                    </div>

                    {/* Right side: Icons */}
                    <div className="rightside-div icon-bar">
                        {/* Notifications */}
                        <div className="icon-wrapper">
                            <ion-icon name="notifications-outline" className="icon"></ion-icon>
                            <div className="dropdown-menu dropdown-menu-notification">
                                <a href="#">Notification 1</a>
                                <a href="#">Notification 2</a>
                                <a href="#">Notification 3</a>
                            </div>
                        </div>

                        {/* Language */}
                        <div className="icon-wrapper">
                            <ion-icon name="language-outline" className="icon"></ion-icon>
                            <div className="dropdown-menu">
                                <a href="#">English</a>
                                <a href="#">Chinese</a>
                            </div>
                        </div>

                        {/* Person */}
                        <div className="icon-wrapper">
                            <ion-icon name="person-outline" className="icon"></ion-icon>
                            <div className="dropdown-menu">
                                <a href="#">Settings</a>
                                <a href="#">Login</a>
                            </div>
                        </div>
                    </div>
                </nav>
            </div>
        </header>
    );
}
