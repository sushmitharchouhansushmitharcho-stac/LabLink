import bcrypt from 'bcryptjs';
import { User, Resource } from './models.js';

export default async function seed() {
  await User.updateMany({ role: 'faculty' }, { $set: { role: 'facultyCoordinator' } });
  await User.updateMany({ active: { $exists: false } }, { $set: { active: true } });
  const demos = [
    ['DEMO_STUDENT_PASSWORD', 'student@lablink.demo', 'Student Demo', 'student'],
    ['DEMO_FACULTY_PASSWORD', 'faculty@lablink.demo', 'Faculty Coordinator Demo', 'facultyCoordinator'],
    ['DEMO_LAB_INCHARGE_PASSWORD', 'labincharge@lablink.demo', 'Lab In-Charge Demo', 'labInCharge'],
    ['DEMO_DEAN_PASSWORD', 'dean@lablink.demo', 'Dean Demo', 'dean'],
    ['DEMO_ADMIN_PASSWORD', 'admin@lablink.demo', 'System Admin Demo', 'admin'],
  ];
  for (const [environmentKey, email, name, role] of demos) {
    const rawPassword = process.env[environmentKey];
    if (!rawPassword) continue;
    if (rawPassword.length < 12) throw new Error(`${environmentKey} must contain at least 12 characters`);
    if (await User.exists({ email })) continue;
    const password = await bcrypt.hash(rawPassword, 12);
    await User.updateOne(
      { email },
      { $setOnInsert: { name, email, password, role, department: 'Configure department', active: true } },
      { upsert: true },
    );
  }
  if (!demos.some(([key]) => process.env[key])) {
    console.warn('Demo accounts were not created; configure DEMO_*_PASSWORD values in the server environment.');
  }
  if (await Resource.countDocuments()) return;

  const R = (name, category, department, lab, location, total, description, specs, tags, status = 'active') =>
    ({ name, category, department, lab, location, total, available: status === 'active' ? total : 0, description, specs, tags, status });
  await Resource.create([
    R('Raspberry Pi 5 Kit', 'Development Kit', 'Computer Science', 'Embedded Systems Lab', 'Block A, Room 204', 12, 'Single-board computer kit for IoT, edge AI and robotics projects.', ['Quad-core Cortex-A76', '8GB RAM', 'Wi-Fi + Bluetooth', 'GPIO 40-pin'], ['iot', 'robotics', 'linux', 'edge ai']),
    R('Arduino Mega Starter Kit', 'Development Kit', 'Electronics', 'Electronics Lab 1', 'Block B, Room 101', 20, 'Microcontroller kit with sensors, motors and breadboard.', ['ATmega2560', '54 digital I/O', 'Sensor pack', 'Servo + stepper'], ['arduino', 'sensors', 'microcontroller', 'embedded']),
    R('NVIDIA Jetson Orin Nano', 'Development Kit', 'Computer Science', 'AI & ML Lab', 'Block A, Room 310', 4, 'Compact GPU module for computer vision and deep-learning deployment.', ['40 TOPS AI performance', '8GB LPDDR5', 'CUDA / TensorRT', 'CSI camera input'], ['ai', 'machine learning', 'vision', 'gpu']),
    R('Digital Storage Oscilloscope', 'Instrument', 'Electronics', 'Electronics Lab 2', 'Block B, Room 105', 6, '4-channel oscilloscope for signal analysis and debugging.', ['200 MHz bandwidth', '4 channels', '1 GS/s', 'USB export'], ['signals', 'circuits', 'debugging', 'measurement']),
    R('Spectrum Analyzer', 'Instrument', 'Electronics', 'RF & Communication Lab', 'Block B, Room 120', 2, 'Frequency-domain analysis for RF and communication projects.', ['9 kHz - 3 GHz', 'Tracking generator', 'USB/LAN'], ['rf', 'communication', 'antenna', 'wireless']),
    R('FPGA Development Board (Artix-7)', 'Development Kit', 'Electronics', 'VLSI Lab', 'Block C, Room 012', 8, 'FPGA board for digital design, HDL and hardware acceleration.', ['Xilinx Artix-7', '100K logic cells', 'Vivado compatible', 'HDMI / Ethernet'], ['fpga', 'vlsi', 'verilog', 'hardware acceleration']),
    R('Ansys Student Licence Pool', 'Software', 'Mechanical', 'CAE Lab', 'Block D, Room 201', 15, 'Simulation suite for structural, thermal and fluid analysis.', ['Mechanical + Fluent', 'Remote access', '15 seats'], ['simulation', 'fea', 'cfd', 'thermal']),
    R('Prusa 3D Printer', 'Fabrication', 'Mechanical', 'Makerspace', 'Block D, Room 005', 5, 'FDM 3D printer for prototyping enclosures and mechanical parts.', ['250x210x210 mm', 'PLA / PETG / ABS', '0.05 mm layer'], ['3d printing', 'prototype', 'enclosure', 'cad']),
    R('Universal Testing Machine', 'Instrument', 'Civil', 'Materials Testing Lab', 'Block E, Room 001', 1, 'Tensile and compression testing for materials.', ['600 kN capacity', 'Digital load cell', 'Extensometer'], ['materials', 'strength', 'tensile', 'concrete']),
    R('GPU Compute Workstation', 'Computing', 'Computer Science', 'HPC Lab', 'Block A, Room 401', 3, 'High-memory workstation for model training and rendering.', ['RTX 4090 24GB', '128GB RAM', 'Ubuntu + CUDA'], ['deep learning', 'training', 'gpu', 'rendering']),
    R('PCB Milling Machine', 'Fabrication', 'Electronics', 'Makerspace', 'Block B, Room 010', 1, 'In-house PCB prototyping without outsourcing.', ['0.1 mm trace', 'Double-sided', 'Auto tool change'], ['pcb', 'prototype', 'circuits'], 'maintenance'),
    R('Biomedical Sensor Kit (ECG/EMG)', 'Development Kit', 'Biomedical', 'Biosignal Lab', 'Block F, Room 110', 7, 'Wearable-grade sensors for biosignal acquisition projects.', ['ECG, EMG, SpO2', 'Bluetooth streaming', 'Python SDK'], ['health', 'biosignal', 'wearable', 'ecg']),
  ]);
  console.log('Seeded LabLink resource catalogue.');
}
