
'use client';

import { useEffect, useState } from 'react';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { AppLayout } from '@/components/app-layout';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

// --- Hardcoded Correct Data ---

const psjaSponsorData = [
    { firstName: 'Yadira', lastName: 'Alvarado', email: 'yadira.alvarado@psjaisd.us', school: 'EDITH & ETHEL CARMAN EL', district: 'PHARR-SAN JUAN-ALAMO ISD', bookkeeperEmail: '', gtCoordinatorEmail: 'noemi.cuello@psjaisd.us' },
    { firstName: 'Vivian', lastName: 'Barbosa', email: 'vivian.barbosa@psjaisd.us', school: 'JOHN MCKEEVER EL', district: 'PHARR-SAN JUAN-ALAMO ISD', bookkeeperEmail: '', gtCoordinatorEmail: 'noemi.cuello@psjaisd.us' },
    { firstName: 'Rene', lastName: 'Trevino', email: 'rene.trevino@psjaisd.us', school: 'GRACIELA GARCIA EL', district: 'PHARR-SAN JUAN-ALAMO ISD', bookkeeperEmail: 'rene.trevino@psjaisd.us', gtCoordinatorEmail: 'noemi.cuello@psjaisd.us' },
    { firstName: 'Juan', lastName: 'Lopez', email: 'juan.lopez1@psjaisd.us', school: 'ARNOLDO CANTU SR EL', district: 'PHARR-SAN JUAN-ALAMO ISD', bookkeeperEmail: 'alicia.salinas@psjaisd.us', gtCoordinatorEmail: 'noemi.cuello@psjaisd.us' },
    { firstName: 'Alexis', lastName: 'Martinez', email: 'alexis.martinez@psjaisd.us', school: 'AMANDA GARZA-PENA EL', district: 'PHARR-SAN JUAN-ALAMO ISD', bookkeeperEmail: 'alexis.martinez@psjaisd.us', gtCoordinatorEmail: 'noemi.cuello@psjaisd.us' },
    { firstName: 'Oscar', lastName: 'Quintanilla', email: 'oscar.quintanilla@psjaisd.us', school: 'AMANDA GARZA-PENA EL', district: 'PHARR-SAN JUAN-ALAMO ISD', bookkeeperEmail: 'oscar.quintanilla@psjaisd.us', gtCoordinatorEmail: 'oscar.quintanilla@psjaisd.us' },
    { firstName: 'Stephanie', lastName: 'Casares', email: 'stephanie.casares@psjaisd.us', school: 'SANTOS LIVAS EL', district: 'PHARR-SAN JUAN-ALAMO ISD', bookkeeperEmail: 'stephanie.casares@psjaisd.us', gtCoordinatorEmail: 'noemi.cuello@psjaisd.us' },
    { firstName: 'Yeimi', lastName: 'Garcia Matuk', email: 'yeimi.garcia@psjaisd.us', school: 'DR WILLIAM LONG EL', district: 'PHARR-SAN JUAN-ALAMO ISD', bookkeeperEmail: 'sandra.ojeda@psjaisd.us', gtCoordinatorEmail: 'noemi.cuello@psjaisd.us' },
    { firstName: 'Kanie', lastName: 'De Leon', email: 'kanie.deleon@psjaisd.us', school: 'AUSTIN MIDDLE', district: 'PHARR-SAN JUAN-ALAMO ISD', bookkeeperEmail: 'kanie.deleon@psjaisd.us', gtCoordinatorEmail: 'noemi.cuello@psjaisd.us' },
    { firstName: 'Ashley', lastName: 'Rodriguez', email: 'ashley.rodriguez@psjaisd.us', school: 'PSJA COLLEGIATE SCHOOL OF HEALTH PROFESSIONS', district: 'PHARR-SAN JUAN-ALAMO ISD', bookkeeperEmail: '', gtCoordinatorEmail: 'noemi.cuello@psjaisd.us' },
    { firstName: 'Sebastian', lastName: 'Tijerina', email: 'sebastian.tijerina@psjaisd.us', school: 'AIDA C ESCOBAR EL', district: 'PHARR-SAN JUAN-ALAMO ISD', bookkeeperEmail: 'rosanna.pedroza@psjaisd.us', gtCoordinatorEmail: 'noemi.cuello@psjaisd.us' },
    { firstName: 'Maria Sheila', lastName: 'Sinapuelas', email: 'maria.sinapuelas@psjaisd.us', school: 'GRACIELA GARCIA EL', district: 'PHARR-SAN JUAN-ALAMO ISD', bookkeeperEmail: 'maria.sinapuelas@psjaisd.us', gtCoordinatorEmail: 'noemi.cuello@psjaisd.us' },
    { firstName: 'Roberto', lastName: 'Madrigal', email: 'roberto.madrigal@psjaisd.us', school: 'DRS REED - MOCK EL', district: 'PHARR-SAN JUAN-ALAMO ISD', bookkeeperEmail: 'kimberly.munoz@psjaisd.us', gtCoordinatorEmail: 'noemi.cuello@psjaisd.us' },
    { firstName: 'Rafael', lastName: 'Chico', email: 'rafael.rodriguez@psjaisd.us', school: 'AUSTIN MIDDLE', district: 'PHARR-SAN JUAN-ALAMO ISD', bookkeeperEmail: '', gtCoordinatorEmail: 'noemi.cuello@psjaisd.us' },
    { firstName: 'Diana', lastName: 'Sanchez', email: 'diana.sanchez@psjaisd.us', school: 'SANTOS LIVAS EL', district: 'PHARR-SAN JUAN-ALAMO ISD', bookkeeperEmail: 'veronica.cervantes@psjaisd.us', gtCoordinatorEmail: 'noemi.cuello@psjaisd.us' },
    { firstName: 'Hernan', lastName: 'Cortez', email: 'hernan.cortez@psjaisd.us', school: 'KENNEDY MIDDLE', district: 'PHARR-SAN JUAN-ALAMO ISD', bookkeeperEmail: 'hernan.cortez@psjaisd.us', gtCoordinatorEmail: 'noemi.cuello@psjaisd.us' },
    { firstName: 'Alonzo', lastName: 'Hernandez', email: 'alonzo.hernandez@psjaisd.us', school: 'AUDIE MURPHY MIDDLE', district: 'PHARR-SAN JUAN-ALAMO ISD', bookkeeperEmail: 'alonzo.hernandez@psjaisd.us', gtCoordinatorEmail: 'noemi.cuello@psjaisd.us' },
    { firstName: 'Vasthi', lastName: 'Rodriguez', email: 'vasthi.rodriguez@psjaisd.us', school: 'PSJA COLLEGIATE SCHOOL OF HEALTH PROFESSIONS', district: 'PHARR-SAN JUAN-ALAMO ISD', bookkeeperEmail: 'vasthi.rodriguez@psjaisd.us', gtCoordinatorEmail: 'noemi.cuello@psjaisd.us' },
    { firstName: 'Virginia', lastName: 'Ibarra', email: 'virginia.ibarra@psjaisd.us', school: 'AUGUSTO GUERRA EL', district: 'PHARR-SAN JUAN-ALAMO ISD', bookkeeperEmail: '', gtCoordinatorEmail: 'noemi.cuello@psjaisd.us' },
    { firstName: 'Omar', lastName: 'Armenta', email: 'omar.armenta@psjaisd.us', school: 'DR WILLIAM LONG EL', district: 'PHARR-SAN JUAN-ALAMO ISD', bookkeeperEmail: 'sandra.ojeda@psjaisd.us', gtCoordinatorEmail: 'noemi.cuello@psjaisd.us' },
    { firstName: 'Moises', lastName: 'Diaz', email: 'moises.diaz@psjaisd.us', school: 'PSJA THOMAS JEFFERSON T-STEM EARLY COLLEGE H S', district: 'PHARR-SAN JUAN-ALAMO ISD', bookkeeperEmail: 'veronica.lazo@psjaisd.us', gtCoordinatorEmail: 'noemi.cuello@psjaisd.us' },
    { firstName: 'Guadalupe', lastName: 'Elizondo', email: 'guadalupe.elizondo2@psjaisd.us', school: 'GERALDINE PALMER EL', district: 'PHARR-SAN JUAN-ALAMO ISD', bookkeeperEmail: '', gtCoordinatorEmail: 'noemi.cuello@psjaisd.us' },
    { firstName: 'Lolly', lastName: 'Galvan', email: 'lolly.galvan@psjaisd.us', school: 'GERALDINE PALMER EL', district: 'PHARR-SAN JUAN-ALAMO ISD', bookkeeperEmail: '', gtCoordinatorEmail: 'noemi.cuello@psjaisd.us' },
    { firstName: 'Corina', lastName: 'Perez', email: 'corina.perez@psjaisd.us', school: 'ALFRED SORENSEN EL', district: 'PHARR-SAN JUAN-ALAMO ISD', bookkeeperEmail: '', gtCoordinatorEmail: 'noemi.cuello@psjaisd.us' },
];

const gtPlayerUscfIds = new Set([
    "31489035", "31489051", "31489062", "31489095",
    "32063642", "32063726", "32063733", "32063759", "32064001", "32115736", "32115752", "32156812", "32156857", "32156866", "32157003",
    "122025", "3148913", "31489122", "31489134", "31489160", "31489171", "32042219", "32052377",
    "30308734", "30728261", "30764837", "32052478", "32052515", "32052572", "32195702",
    "3209070", "30298695", "30858424", "31489306", "31489536", "31679022", "32115244",
    "138616",
    "16469688", "16800831", "16800852", "17154766", "30298794", "30347260", "30347282", "30769889", "31487695", "31487845", "31497168", "32063717", "32114967", "32114974", "32115788", "32155993", "32062900",
    "31498736", "32052839", "32052866", "32052881",
    "30874987", "31460269", "31489687", "31489915", "32052426", "32115565", "32115583", "32115634", "32115648",
    "32115099", "32115102", "32115113", "32115122", "32115130", "32115141", "32115151", "32115194", "32195946", "32256481", "321115089",
    "30308816", "30764897", "31491001", "31491012",
    "30271062", "30728191", "31489716", "31489894", "31489934", "32115166", "32115265",
    "15863055", "16801086", "30299472", "30309132", "31488082", "31499254", "32046484",
    "16112301", "16112426", "31490089", "31499413", "31499459", "31606813", "32046572", "32115836", "32115845", "158652994",
    "30764804", "30764848", "30764869", "31489349", "31489397",
]);

const gtPlayersByNameAndSchool = new Set([
    'Landon Arriaga-AIDA C ESCOBAR EL', 'Camila Espinoza-AIDA C ESCOBAR EL', 'Sebastian Garcia-AIDA C ESCOBAR EL',
    'Matias Izaguirre-AIDA C ESCOBAR EL', 'Ian Madera-AIDA C ESCOBAR EL', 'Erik Martinez-AIDA C ESCOBAR EL',
    'Jonathon Monroy-AIDA C ESCOBAR EL', 'Luna Rodeiguez-AIDA C ESCOBAR EL', 'Jaxson Tate-AIDA C ESCOBAR EL',
    'Gabriela Vazquez-AIDA C ESCOBAR EL', 'Jose Adame Garcia-AMANDA GARZA-PENA EL', 'Jocelyn Alaniz-AMANDA GARZA-PENA EL',
    'Aubrey Castillo-AMANDA GARZA-PENA EL', 'Romany Cortina-AMANDA GARZA-PENA EL', 'Jermaine Guzman-AMANDA GARZA-PENA EL',
    'Ka-El Ramirez-AMANDA GARZA-PENA EL', 'Flavia Tavera-AMANDA GARZA-PENA EL', 'Alijah Vega-AMANDA GARZA-PENA EL',
    'Romeo Cano-ARNOLDO CANTU SR EL', 'Clarity Cantu-ARNOLDO CANTU SR EL', 'Joshua Flores-ARNOLDO CANTU SR EL',
    'Jadiel Garcia-ARNOLDO CANTU SR EL', 'Dariel Gonzalez-ARNOLDO CANTU SR EL', 'Jayde Valle-ARNOLDO CANTU SR EL',
    'Bianca Betancourt-KENNEDY MIDDLE', 'Juan Grimaldo-KENNEDY MIDDLE', 'Joaquin Rodriguez-AUDIE MURPHY MIDDLE',
    'Giovanna Casteneda-AUGUSTO GUERRA EL', 'Daniel Jackson-AUGUSTO GUERRA EL', 'Avril Navarro-AUGUSTO GUERRA EL',
    'Khalysi Perez-AUGUSTO GUERRA EL', 'Leonel Valdez-AUGUSTO GUERRA EL', 'Joseph Alvarado-AUSTIN MIDDLE',
    'Dallas Evans-AUSTIN MIDDLE', 'Matthew Gonzalez-AUSTIN MIDDLE', 'Luke Nava-AUSTIN MIDDLE', 'Ezra Rivera-AUSTIN MIDDLE',
    'Emely Romero-AUSTIN MIDDLE', 'Diego Cortes-DR WILLIAM LONG EL', 'Ryan Garcia-DR WILLIAM LONG EL', 'Liam Madrigal-DR WILLIAM LONG EL',
    'Mia Monrreal-DR WILLIAM LONG EL', 'Kalista Elizondo-GERALDINE PALMER EL', 'Mateo Soto-GERALDINE PALMER EL',
    'Janell Cruz-GRACIELA GARCIA EL', 'Maximiliano Gonzalez-GRACIELA GARCIA EL', 'Michael Gonzalez-GRACIELA GARCIA EL',
    'Elizabeth Lopez-GRACIELA GARCIA EL', 'Javier Lopez-GRACIELA GARCIA EL', 'Zoe Martinez-GRACIELA GARCIA EL',
    'Erick Mata-GRACIELA GARCIA EL', 'Brianna Ramirez-GRACIELA GARCIA EL', 'Fernanda Talancon-GRACIELA GARCIA EL',
    'Karim Vasquez-GRACIELA GARCIA EL', 'Alayna Calderon-JOHN MCKEEVER EL', 'Lizeth De Leon-JOHN MCKEEVER EL',
    'Abel Garza-JOHN MCKEEVER EL', 'Gael Torres-JOHN MCKEEVER EL', 'Noah Hinojosa-PSJA THOMAS JEFFERSON T-STEM EARLY COLLEGE H S',
    'Emma Andreas-SANTOS LIVAS EL', 'Georgina Arriaga-SANTOS LIVAS EL', 'Victoria Castro-SANTOS LIVAS EL', 'Raven Hernandez-SANTOS LIVAS EL',
    'Valentina Maldonado-SANTOS LIVAS EL', 'Jescilia Martinez-SANTOS LIVAS EL', 'Ricardo Monrroy-SANTOS LIVAS EL',
    'Yadier portillo-SANTOS LIVAS EL', 'Madison Tapia-SANTOS LIVAS EL', 'Dylan Trevino-SANTOS LIVAS EL', 'Matias Trevino Duarte-SANTOS LIVAS EL'
]);


const correctedInvoices = [
  { invoiceId: 'inv:0-ChDR7q-F0W8c3_001d90c12cEJ8I', invoiceNumber: '4320', purchaserEmail: 'omar.armenta@psjaisd.us', players: [ { name: 'Ivan Ramirez', uscfId: '30298479' }, { name: 'Skylar Mendiola', uscfId: '30769940' }, { name: 'Kenzie Aviles', uscfId: '31488558' }, { name: 'Gabriella Rendon', uscfId: '31488628' }, { name: 'Ruben Salinas', uscfId: '31488644' }, { name: 'AnnaBelle Tagle', uscfId: '31488924' }, { name: 'Jorge Cantu', uscfId: 'NEW' }, { name: 'Melinna Zuniga', uscfId: 'NEW' }, { name: 'Luke Castro', uscfId: 'NEW' } ], uscfRenewals: ['Jorge Cantu', 'Melinna Zuniga', 'Luke Castro'] },
  { invoiceId: 'inv:0-ChA-some_unique_id_for_4318', invoiceNumber: '4318', purchaserEmail: 'maria.sinapuelas@psjaisd.us', players: [ { name: 'Natalie Lopez', uscfId: '32256928' }, { name: 'Joshua Martinez', uscfId: '30367625' } ], uscfRenewals: [] },
  { invoiceId: 'inv:0-ChA-some_unique_id_for_4317', invoiceNumber: '4317', purchaserEmail: 'hernan.cortez@psjaisd.us', players: [ { name: 'Airam Ramirez-Loredo', uscfId: '32157156' } ], uscfRenewals: [] },
  { invoiceId: 'inv:0-ChAV3g-9g0a9FX8D-m77z3-wEJ8I', invoiceNumber: '4315', purchaserEmail: 'guadalupe.elizondo2@psjaisd.us', players: [ { name: 'Matias Chavez', uscfId: '32052592' } ], uscfRenewals: [] },
  { invoiceId: 'inv:0-ChBvHo9HhSLsFXoFmT96z3-wEJ8I', invoiceNumber: '4314', purchaserEmail: 'ashley.rodriguez@psjaisd.us', players: [ { name: 'Esteban Garza JR', uscfId: '15863055' }, { name: 'Kate Fernandez', uscfId: '16801086' }, { name: 'Raul Gonzalez III', uscfId: '30299472' }, { name: 'Orlando Delgado Garcia', uscfId: '30309132' }, { name: 'Jorge Cantu Alvarez', uscfId: '31488082' }, { name: 'Diego Bocanegra Amaro', uscfId: '31499254' }, { name: 'Azul Cuevas Elizalde', uscfId: '32046484' } ], uscfRenewals: [] },
  { invoiceId: 'inv:0-ChBqF8jY6Yf2Kk8YxH4-mJj0EJ8I', invoiceNumber: '4313', purchaserEmail: 'kanie.deleon@psjaisd.us', players: [ { name: 'Cianni Vargas', uscfId: '16800831' }, { name: 'Emiliano Medina', uscfId: '30298794' }, { name: 'Carlos De Leon JR', uscfId: '30347260' }, { name: 'Fatima Garza', uscfId: '30347282' }, { name: 'Damian Cuellar', uscfId: '31487695' }, { name: 'Enzo Cervantes', uscfId: '31487845' }, { name: 'Heriberto Garza JR', uscfId: '32114974' }, { name: 'Matthew Gonzalez', uscfId: 'NEW' }, { name: 'Dallas Evans', uscfId: 'NEW' }, { name: 'Ezra Rivera', uscfId: 'NEW' } ], uscfRenewals: [ 'Cianni Vargas', 'Emiliano Medina', 'Carlos De Leon JR', 'Fatima Garza', 'Matthew Gonzalez', 'Dallas Evans', 'Ezra Rivera' ] },
  { invoiceId: 'inv:0-ChAn7iUtCfPpjCRGA9NEEaE9EJ8I', invoiceNumber: '4312', purchaserEmail: 'hernan.cortez@psjaisd.us', players: [ { name: 'Luis Cortez', uscfId: '30271062' }, { name: 'Rodrigo Izaguirre', uscfId: '30728191' }, { name: 'Jesus Cordero', uscfId: '31489716' }, { name: 'Jayden Jimenez', uscfId: '31489894' }, { name: 'Raul Pedraza Jr.', uscfId: '31489934' }, { name: 'Ruben Elizondo', uscfId: '32115166' }, { name: 'Norberto Gonzalez', uscfId: '32115265' }, { name: 'Ruben Paez', uscfId: '32115492' }, { name: 'Aurik Romo', uscfId: 'NEW' }, { name: 'Jocelyn Snow', uscfId: 'NEW' } ], uscfRenewals: ['Rodrigo Izaguirre', 'Aurik Romo', 'Jocelyn Snow'] },
  { invoiceId: 'inv:0-ChBdDmnPzwd4w1bnyDo6_TiqEJ8I', invoiceNumber: '4311', purchaserEmail: 'corina.perez@psjaisd.us', players: [ { name: 'Arianna Cantu', uscfId: '32063642' }, { name: 'Austin Salinas', uscfId: '32063726' }, { name: 'Jace Sandoval', uscfId: '32063733' }, { name: 'Adrian Villa', uscfId: '32063759' }, { name: 'Hiram Flores', uscfId: '32064001' }, { name: 'Landen Valerio', uscfId: '32115736' }, { name: 'Saori Tamez', uscfId: '32115752' }, { name: 'Matthew De La Cruz', uscfId: '32156812' }, { name: 'Amirah Jalili', uscfId: '32156857' }, { name: 'Shenell Vaca', uscfId: '32156866' }, { name: 'Silas De La Garza', uscfId: '32157003' } ], uscfRenewals: [] },
  { invoiceId: 'inv:0-ChBNQswPcqy73RC1UKsvtOzjEJ8I', invoiceNumber: '4310', purchaserEmail: 'vivian.barbosa@psjaisd.us', players: [ { name: 'Ethan Gonzalez', uscfId: '30308816' }, { name: 'Ezra Gonzalez', uscfId: '30764897' }, { name: 'Noah Vives', uscfId: '31491001' }, { name: 'Abel Garza', uscfId: 'NEW' }, { name: 'Lizeth De Leon', uscfId: 'NEW' }, { name: 'Alayna Calderon', uscfId: 'NEW' }, { name: 'Gael Torres', uscfId: 'NEW' }, { name: 'Noe Garza', uscfId: 'NEW' }, { name: 'Rocco Sloss', uscfId: 'NEW' }, { name: 'Vanessa Lopez', uscfId: 'NEW' }, { name: 'Lucia Gonzalez', uscfId: 'NEW' }, { name: 'Josue Contreras', uscfId: 'NEW' } ], uscfRenewals: ['Alayna Calderon', 'Gael Torres', 'Noe Garza', 'Rocco Sloss', 'Vanessa Lopez', 'Lucia Gonzalez', 'Josue Contreras'] },
  { invoiceId: 'inv:0-ChBHdh1QYkO8HnPidl0QmuWvEJ8I', invoiceNumber: '4306', purchaserEmail: 'guadalupe.elizondo2@psjaisd.us', players: [ { name: 'Matthew Trevino', uscfId: '32042450' }, { name: 'Liam Salinas', uscfId: 'New' } ], uscfRenewals: ['Liam Salinas'] },
  { invoiceId: 'inv:0-ChCmSldsxygecLHLDtuGWraXEJ8I', invoiceNumber: '4304', purchaserEmail: 'yeimi.garcia@psjaisd.us', players: [ { name: 'Austin Zepeda', uscfId: '31498736' }, { name: 'Kaillou Cardenas', uscfId: '32052839' }, { name: 'Neva Quintana', uscfId: '32052866' }, { name: 'Henry Teyer', uscfId: '32052881' }, { name: 'Mia Monrreal', uscfId: 'NEW' }, { name: 'Diego Cortes', uscfId: 'NEW' }, { name: 'Ryan Garcia', uscfId: 'NEW' }, { name: 'Liam Madrigal', uscfId: 'NEW' } ], uscfRenewals: ['Mia Monrreal', 'Diego Cortes', 'Ryan Garcia', 'Liam Madrigal'] },
  { invoiceId: 'inv:0-ChCWUBF_yvdJJNj1hxBeOQwjEJ8I', invoiceNumber: '4305', purchaserEmail: 'guadalupe.elizondo2@psjaisd.us', players: [ { name: 'Sofia Lee Reyes', uscfId: '30874987' }, { name: 'Michael Trevino', uscfId: '32052426' }, { name: 'Devin Garcia', uscfId: '32115565' }, { name: 'Leonardo Martinez', uscfId: '32115583' }, { name: 'lauren Sauceda', uscfId: '32115634' }, { name: 'Briana Garcia', uscfId: '32115648' }, { name: 'Mateo Soto', uscfId: 'New' } ], uscfRenewals: ['Mateo Soto'] },
  { invoiceId: 'inv:0-ChBaPl56VbrMq6-fQWViXjt_EJ8I', invoiceNumber: '4303', purchaserEmail: 'sebastian.tijerina@psjaisd.us', players: [ { name: 'Sebastian Garcia', uscfId: 'NEW' }, { name: 'Landon Garza', uscfId: '31489035' }, { name: 'Jonathan Landero', uscfId: '31489051' }, { name: 'Claudio Ovalle', uscfId: '31489062' }, { name: 'Luciana Torres', uscfId: '31489095' }, { name: 'Roy Gonzalez', uscfId: '31499271' }, { name: 'Emari Salinas', uscfId: 'NEW' }, { name: 'Daniel Diaz', uscfId: 'NEW' }, { name: 'Jaxson Tate', uscfId: 'NEW' }, { name: 'Lilian Cruz', uscfId: 'NEW' }, { name: 'Jayden Luther', uscfId: 'NEW' }, { name: 'Camila Espinoza', uscfId: 'NEW' }, { name: 'Jonathon Monroy', uscfId: 'NEW' }, { name: 'Matias Izaguirre', uscfId: 'NEW' }, { name: 'Matias Izaguirre', uscfId: 'NEW' }, { name: 'Luna Rodeiguez', uscfId: 'NEW' }, { name: 'Erik Martinez', uscfId: 'NEW' }, { name: 'Landon Arriaga', uscfId: 'NEW' }, { name: 'Gabriela Vazquez', uscfId: 'NEW' }, { name: 'Ian Madera', uscfId: 'NEW' }, { name: 'Iker Cruz', uscfId: 'NEW' } ], uscfRenewals: ['Sebastian Garcia', 'Landon Garza', 'Jonathan Landero', 'Claudio Ovalle', 'Luciana Torres', 'Roy Gonzalez', 'Emari Salinas', 'Daniel Diaz', 'Jaxson Tate', 'Lilian Cruz', 'Jayden Luther', 'Camila Espinoza', 'Jonathon Monroy', 'Matias Izaguirre', 'Matias Izaguirre', 'Luna Rodeiguez', 'Erik Martinez', 'Landon Arriaga', 'Gabriela Vazquez', 'Ian Madera', 'Iker Cruz'] },
  { invoiceId: 'inv:0-ChAFLjzZWmImp8hjFZN77oS-EJ8I', invoiceNumber: '4302', purchaserEmail: 'guadalupe.elizondo2@psjaisd.us', players: [ { name: 'Matthew Trevino', uscfId: 'New' }, { name: 'Liam Salinas', uscfId: 'New' }, { name: 'Briana Garcia', uscfId: 'New' }, { name: 'Devin Garcia', uscfId: 'New' }, { name: 'Mateo Soto', uscfId: 'New' }, { name: 'Sofia Lee Reyes', uscfId: 'New' }, { name: 'Leonardo Martinez', uscfId: 'New' }, { name: 'Michael Trevino', uscfId: 'New' } ], uscfRenewals: ['Matthew Trevino', 'Liam Salinas', 'Briana Garcia', 'Devin Garcia', 'Mateo Soto', 'Sofia Lee Reyes', 'Leonardo Martinez', 'Michael Trevino'] },
  { invoiceId: 'inv:0-ChDxVsUuK-JVya_ZzZUpon1gEJ8I', invoiceNumber: '4301', purchaserEmail: 'rene.trevino@psjaisd.us', players: [ { name: 'Joshua Martinez', uscfId: '30367625' }, { name: 'Juan Espinoza', uscfId: '32115099' }, { name: 'Noel Saucedo Ravise', uscfId: '32115102' }, { name: 'Jorge Guillen', uscfId: '32115113' }, { name: 'Aldo De Luna', uscfId: '32115122' }, { name: 'Olivia Garza', uscfId: '32115130' }, { name: 'Jose Gonzalez', uscfId: '32115141' }, { name: 'Olivia Garcia', uscfId: '32115151' }, { name: 'Sebastian Mena', uscfId: '32115194' }, { name: 'Ramses De Luna', uscfId: '32195946' }, { name: 'Alice Betancourt', uscfId: '32256481' }, { name: 'Natalie Lopez', uscfId: '32256928' }, { name: 'Scarlett Perez', uscfId: '321115089' }, { name: 'Zoe Martinez', uscfId: 'new' }, { name: 'Janell Cruz', uscfId: 'new' }, { name: 'Karim Vasquez', uscfId: 'new' }, { name: 'Brianna Ramirez', uscfId: 'NEW' }, { name: 'Javier Lopez', uscfId: 'NEW' }, { name: 'Maximiliano Gonzalez', uscfId: 'NEW' }, { name: 'Michael Gonza', uscfId: 'NEW' } ], uscfRenewals: ['Zoe Martinez', 'Janell Cruz', 'Karim Vasquez', 'Brianna Ramirez', 'Javier Lopez', 'Maximiliano Gonzalez', 'Michael Gonza'] },
  { invoiceId: 'inv:0-ChBMhCueCIThav0cbt_OhdfvEJ8I', invoiceNumber: '4300', purchaserEmail: 'alonzo.hernandez@psjaisd.us', players: [ { name: 'Luciano Flores', uscfId: '3209070' }, { name: 'ricardo vela', uscfId: '30298695' }, { name: 'Devin Flores', uscfId: '30858424' }, { name: 'Anthony Sanchez', uscfId: '31489306' }, { name: 'Jake Lopez', uscfId: '31489536' }, { name: 'Eli Ramos', uscfId: '31679022' }, { name: 'Jose Nicanor', uscfId: '32115244' }, { name: 'Joaquin Rodriguez', uscfId: 'New' }, { name: 'Amen Torres', uscfId: 'New' } ], uscfRenewals: ['Devin Flores', 'Eli Ramos', 'Joaquin Rodriguez', 'Amen Torres'] },
  { invoiceId: 'inv:0-DQLHUvzOpAoD3bsGx7FqR9EJ8I', invoiceNumber: '4299', purchaserEmail: 'rafael.rodriguez@psjaisd.us', players: [ { name: 'Edward Trevino', uscfId: '16469688' }, { name: 'Benjamin Carpio', uscfId: '16800852' }, { name: 'LIam Chapa', uscfId: '30347273' }, { name: 'Derek Tarango', uscfId: '30769889' }, { name: 'Hezekiah Perez', uscfId: '31497168' }, { name: 'Liam Perez', uscfId: '32063717' }, { name: 'Josiah Hernandez', uscfId: '32114967' }, { name: 'Autumn Garza', uscfId: '32115788' }, { name: 'Luke Nava', uscfId: 'New' } ], uscfRenewals: ['Hezekiah Perez', 'Luke Nava'] },
  { invoiceId: 'inv:0-ChAx46Cd3v8CDBwV5WipTYoxEJ8I', invoiceNumber: '4298', purchaserEmail: 'oscar.quintanilla@psjaisd.us', players: [ { name: 'Athena Munoz', uscfId: '122025' }, { name: 'Ricardo Castillo', uscfId: '3148913' }, { name: 'Cesario Aranda', uscfId: '31489122' }, { name: 'Javier Montes', uscfId: '31489160' }, { name: 'Jax Leal', uscfId: '31489171' }, { name: 'Daniel Tevino', uscfId: '32042219' }, { name: 'Zendrix Oviedo', uscfId: '32049200' }, { name: 'Flavia Tavera', uscfId: 'New' }, { name: 'Alijah Vega', uscfId: 'New' }, { name: 'Jermaine Guzman', uscfId: 'New' } ], uscfRenewals: ['Flavia Tavera', 'Alijah Vega', 'Jermaine Guzman'] },
  { invoiceId: 'inv:0-ChBNzNLwVIafEnQHyBW6urc6EJ8I', invoiceNumber: '4297', purchaserEmail: 'moises.diaz@psjaisd.us', players: [ { name: 'Carlos Martinez', uscfId: '16112301' }, { name: 'Aiden Cantu', uscfId: '16112426' }, { name: 'Alan Alaniz', uscfId: '16473088' }, { name: 'Kaleb Martinez', uscfId: '17207981' }, { name: 'Rogelio Martinez', uscfId: '31490089' }, { name: 'Jose Cavazos', uscfId: '31499413' }, { name: 'Reynaldo Carranza', uscfId: '31499459' }, { name: 'Alexa Martinez - Valdvia', uscfId: '31606813' }, { name: 'Timothy Perez', uscfId: '32046572' }, { name: 'Esmeralda Torres', uscfId: '32115836' }, { name: 'Aliyah Cantu', uscfId: '32115845' }, { name: 'Dwayne Lozano', uscfId: '158652994' }, { name: 'Noah Hinojosa', uscfId: 'NEW' } ], uscfRenewals: ['Reynaldo Carranza', 'Alexa Martinez - Valdvia', 'Noah Hinojosa'] },
  { invoiceId: 'inv:0-ChBuPdz9VuWBFSlozSR4g8JwEJ8I', invoiceNumber: '4296', purchaserEmail: 'juan.lopez1@psjaisd.us', players: [ { name: 'Lucas Arevalo', uscfId: '32052478' } ], uscfRenewals: ['Lucas Arevalo'] },
  { invoiceId: 'inv:0-ChAZegmuSRaJb6UkJ3umHdvnEJ8I', invoiceNumber: '4294', purchaserEmail: 'juan.lopez1@psjaisd.us', players: [ { name: 'Kalee Hernandez', uscfId: '31487795' }, { name: 'Emma Morales', uscfId: '32114990' }, { name: 'Andrea Munoz', uscfId: '32157067' }, { name: 'Ezra Ruiz', uscfId: '32157070' }, { name: 'Manuel Garcia', uscfId: '32256496' }, { name: 'Madelynn Garza', uscfId: '32256631' }, { name: 'Mikayla Anzaldua', uscfId: 'NEW' }, { name: 'Francisco Morales', uscfId: 'NEW' }, { name: 'Emily Requenez', uscfId: 'NEW' }, { name: 'Emmanuel Barrera', uscfId: 'NEW' } ], uscfRenewals: ['Mikayla Anzaldua', 'Francisco Morales', 'Emily Requenez', 'Emmanuel Barrera'] },
  { invoiceId: 'inv:0-ChDjAuarf29_ABRKzwxUMhNKEJ8I', invoiceNumber: '4293', purchaserEmail: 'juan.lopez1@psjaisd.us', players: [ { name: 'Sophia Rangel', uscfId: '30308734' }, { name: 'Natalie Garcia', uscfId: '30764837' }, { name: 'Giancarlo Garcia', uscfId: '32052515' }, { name: 'Ryan Moreno', uscfId: '32052572' }, { name: 'Giovanni Garcia', uscfId: '32195702' }, { name: 'Michael Alaniz', uscfId: '30728261' }, { name: 'Joshua Flores', uscfId: 'NEW' }, { name: 'Dariel Gonzalez', uscfId: 'NEW' }, { name: 'Romeo Cano', uscfId: 'NEW' }, { name: 'Jayde Valle', uscfId: 'NEW' }, { name: 'Jadiel Garcia', uscfId: 'NEW' } ], uscfRenewals: ['Sophia Rangel', 'Natalie Garcia', 'Giancarlo Garcia', 'Ryan Moreno', 'Giovanni Garcia', 'Michael Alaniz', 'Joshua Flores', 'Dariel Gonzalez', 'Romeo Cano', 'Jayde Valle', 'Jadiel Garcia'] },
];

function generatePlayerId(uscfId: string, name: string): string {
    if (uscfId && uscfId.toUpperCase() !== 'NEW' && uscfId.trim() !== '') {
        return uscfId;
    }
    return `temp_${name.replace(/\s+/g, '_')}_${Date.now()}`;
};

export default function ManualInvoiceUpdatePage() {
  const [status, setStatus] = useState('pending');
  const [logs, setLogs] = useState<string[]>([]);
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    const runUpdate = async () => {
      if (status !== 'pending' || !db) return;

      setStatus('running');
      const newLogs: string[] = [];
      let errors = 0;

      const addLog = (message: string, isError = false) => {
        console.log(message);
        newLogs.push(message);
        if (isError) errors++;
        setLogs([...newLogs]);
        setErrorCount(errors);
      };

      addLog(`--- Starting PSJA Invoice Data Migration for 19 Invoices ---`);
      const batch = writeBatch(db);

      for (const inv of correctedInvoices) {
        try {
            const sponsor = psjaSponsorData.find(s => s.email === inv.purchaserEmail);
            if (!sponsor) {
                addLog(`[ERROR] Invoice #${inv.invoiceNumber}: Could not find sponsor with email ${inv.purchaserEmail}. Skipping.`, true);
                continue;
            }

            const selections: Record<string, any> = {};

            for (const p of inv.players) {
                const playerId = generatePlayerId(p.uscfId, p.name);
                const isUscfNeeded = inv.uscfRenewals.includes(p.name);
                const isGt = gtPlayerUscfIds.has(p.uscfId) || gtPlayersByNameAndSchool.has(`${p.name}-${sponsor.school}`);
                
                selections[playerId] = {
                    section: 'High School K-12', // Default section, can be updated later
                    status: 'active',
                    uscfStatus: isUscfNeeded ? 'renewing' : 'current',
                    studentType: isGt ? 'gt' : 'independent'
                };
            }

            const invoiceRecord = {
                id: inv.invoiceId,
                invoiceId: inv.invoiceId,
                invoiceNumber: inv.invoiceNumber,
                type: 'event', // Mark as an event registration
                eventName: "Liberty MS (PSJA students only) on September 13th, 2025",
                eventDate: "2025-09-13T00:00:00.000Z",
                submissionTimestamp: new Date('2025-09-08T12:00:00Z').toISOString(),
                purchaserName: sponsor.firstName + ' ' + sponsor.lastName,
                purchaserEmail: sponsor.email,
                sponsorEmail: sponsor.email,
                schoolName: sponsor.school,
                district: sponsor.district,
                bookkeeperEmail: sponsor.bookkeeperEmail || '',
                gtCoordinatorEmail: sponsor.gtCoordinatorEmail || '',
                invoiceStatus: 'UNPAID', // Assuming all are unpaid initially
                status: 'UNPAID',
                selections: selections,
            };
            
            const invoiceRef = doc(db, 'invoices', inv.invoiceId);
            batch.set(invoiceRef, invoiceRecord, { merge: true });
            addLog(`[SUCCESS] Invoice #${inv.invoiceNumber}: Staged for update with ${Object.keys(selections).length} players.`);

        } catch (error: any) {
            addLog(`[FATAL] Invoice #${inv.invoiceNumber}: Unexpected error during processing - ${error.message}`, true);
        }
      }

      try {
        await batch.commit();
        addLog(`--- BATCH COMMIT COMPLETE ---`);
        addLog(`✅ Successfully committed updates for ${correctedInvoices.length - errors} invoices.`);
        if (errors > 0) {
            addLog(`❌ Encountered ${errors} errors. See logs above for details.`);
        }
      } catch (error: any) {
        addLog(`--- BATCH COMMIT FAILED ---`, true);
        addLog(`Failed to commit updates to Firestore: ${error.message}`, true);
      }

      setStatus('complete');
    };

    runUpdate();
  }, [status]);

  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold font-headline">PSJA Invoice Data Correction</h1>
          <p className="text-muted-foreground mt-2">
            This page runs a one-time script to correct registration data for 19 specific PSJA invoices in Firestore.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Update Status</CardTitle>
            <CardDescription>Review the processing logs below. The script runs automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
                {status === 'pending' && <Badge variant="secondary">Waiting to start...</Badge>}
                {status === 'running' && <Badge variant="default" className="bg-blue-600"><Loader2 className="h-4 w-4 animate-spin mr-2"/>Running update script...</Badge>}
                {status === 'complete' && errorCount === 0 && <Badge variant="default" className="bg-green-600">✅ All Updates Successful!</Badge>}
                 {status === 'complete' && errorCount > 0 && <Badge variant="destructive">❌ Process Completed with ${errorCount} Errors</Badge>}
            </div>
            <ScrollArea className="h-96 w-full rounded-md border p-4">
                <div className="space-y-2 font-mono text-xs">
                    {logs.length > 0 ? logs.map((log, index) => (
                        <p key={index} className={log.includes('[ERROR]') || log.includes('[FATAL]') ? 'text-red-600' : log.includes('[SUCCESS]') ? 'text-green-600' : ''}>
                            {log}
                        </p>
                    )) : 'Script has not run yet.'}
                </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );

    
}

    

    