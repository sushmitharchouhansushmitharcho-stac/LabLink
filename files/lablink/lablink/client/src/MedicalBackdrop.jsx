import React from 'react';
import { Cross, Dna, FlaskConical, Microscope, Pill, Stethoscope, TestTube } from 'lucide-react';

const objects = [
  [Stethoscope, 'medical-object-stethoscope'],
  [Microscope, 'medical-object-microscope'],
  [TestTube, 'medical-object-tube'],
  [FlaskConical, 'medical-object-flask'],
  [Pill, 'medical-object-pill'],
  [Dna, 'medical-object-dna'],
  [Cross, 'medical-object-cross'],
];

export default function MedicalBackdrop() {
  return (
    <div className="medical-backdrop" aria-hidden="true">
      <div className="medical-light medical-light-one" />
      <div className="medical-light medical-light-two" />
      <div className="medical-particles" />
      {objects.map(([Icon, className], index) => <Icon key={className} className={`medical-object ${className}`} strokeWidth={1.1} style={{ '--object-index': index }} />)}
    </div>
  );
}
