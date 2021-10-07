import React from 'react';
import Map from './Map';
import Menu from './Menu';
import logo from '../assets/logo.svg';
import '../styles/App.css';
import {Container, Row, Col } from 'react-bootstrap';


function App() {
        //todo : create Header components
  return (
<div>
  <div className="App">
    <div className="header">
      <img src="../assets/images/geovelo_text_icon.svg" alt="icon text"></img>
      <img src="../assets/images/sig_logo.png" style={{height: '100px'}} alt="logo"></img>
      <h1>Geo Montfort</h1>
    </div>
    <Container fluid>
      <Row>
        <Col md={3}>
          <Menu />
      </Col>
        <Col md={9}>
          <Map />
        </Col>
      </Row>
  </Container>
  </div>
</div>
    )
}

export default App;
