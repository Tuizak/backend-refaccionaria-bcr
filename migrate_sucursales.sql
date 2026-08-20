-- =====================================================
-- INSERTAR LAS 14 SUCURSALES DE BCR
-- Ejecutar una sola vez en la BD
-- =====================================================

INSERT INTO sucursales (id_sucursal, nombre, slug, direccion, activo) VALUES
(1, 'BCR Matriz Mexicali', 'matriz-mexicali', 'Blvd. Lazaro Cardenas 1000, Col. Carbajal, C.P. 21370', 1),
(2, 'BCR San Luis Rio Colorado', 'san-luis-rc', 'Av. Quintana Roo 3284, Col. Jalisco, C.P. 83447', 1),
(3, 'BCR Pedregal', 'pedregal', 'Carr. San Luis Km 15.5, Valle de Puebla, C.P. 21395', 1),
(4, 'BCR Carretera a San Felipe', 'carretera-san-felipe', 'Calz. Manuel Gomez Morin, C.P. 21390', 1),
(5, 'BCR Anahuac', 'anahuac', 'Calz. Anahuac, Col. Indeco Anahuac, C.P. 21060', 1),
(6, 'BCR Rosa del Desierto', 'rosa-del-desierto', 'Calz. Rosa del Desierto 4511, Valle del Pedregal, C.P. 21395', 1),
(7, 'BCR Villa Verde', 'villa-verde', 'Blvd. Lazaro Cardenas 3198, Plaza Local 18, Villa Verde, C.P. 21395', 1),
(8, 'BCR Villanova', 'villanova', 'Blvd. Lazaro Cardenas 1300, Villanova, C.P. 21307', 1),
(9, 'BCR Independencia', 'independencia', 'Calz. Independencia 4692, Col. Independencia, C.P. 21270', 1),
(10, 'BCR Km 43', 'km-43', 'Calz. de los Insurgentes 189, Cd. Guadalupe Victoria, C.P. 21720', 1),
(11, 'BCR Calle 11', 'calle-11', 'Av. Tamaulipas 1901, Zona Urbana Orizaba, C.P. 21140', 1),
(12, 'BCR Vidaurri', 'vidaurri', 'Gral. Santiago Vidaurri 500, Jardines de Calafia, C.P. 21387', 1),
(13, 'BCR Alamitos', 'alamitos', 'Calz. Manuel Gomez Morin 398, Las Hadas, C.P. 21217', 1),
(14, 'BCR Aeropuerto', 'aeropuerto', 'Carr. Aeropuerto Km 7.6, Fracc. Saturno, C.P. 21600', 1)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), slug = VALUES(slug), direccion = VALUES(direccion), activo = VALUES(activo);
