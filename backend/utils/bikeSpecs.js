
export const PREDEFINED_BIKE_SPECS = [
  {
    brand: 'Honda',
    models: [
      'Activa',
      'Activa 6G',
      'Activa 125',
      'Dio',
      'Shine',
      'Unicorn',
      'Hornet 2.0',
      'Hness CB350',
      'CB350RS',
    ],
  },
  {
    brand: 'TVS',
    models: [
      'Jupiter',
      'iQube',
      'Ntorq 125',
      'Apache RTR 160',
      'Apache RTR 200',
      'Raider',
      'XL100',
      'Ronin',
    ],
  },
  {
    brand: 'Suzuki',
    models: ['Access 125', 'Burgman Street', 'Avenis', 'Gixxer 150', 'Gixxer SF 250', 'V-Strom SX'],
  },
  {
    brand: 'Yamaha',
    models: ['Ray ZR 125', 'Fascino 125', 'FZ-S FI', 'MT-15 V2', 'R15 V4', 'Aerox 155', 'FZX'],
  },
  {
    brand: 'Hero',
    models: [
      'Splendor Plus',
      'HF Deluxe',
      'Passion XTEC',
      'Glamour',
      'Xpulse 200 4V',
      'Destini 125',
      'Pleasure Plus',
      'Vida V1',
    ],
  },
  {
    brand: 'Royal Enfield',
    models: [
      'Classic 350',
      'Bullet 350',
      'Meteor 350',
      'Hunter 350',
      'Himalayan 450',
      'Continental GT 650',
      'Interceptor 650',
    ],
  },
  {
    brand: 'Bajaj',
    models: [
      'Pulsar 125',
      'Pulsar 150',
      'Pulsar NS200',
      'Dominar 400',
      'Chetak',
      'Platina',
      'Avenger Cruise 220',
    ],
  },
  {
    brand: 'KTM',
    models: ['Duke 200', 'Duke 250', 'Duke 390', 'RC 200', 'RC 390', 'Adventure 390'],
  },
  { brand: 'Ola', models: ['S1 Pro', 'S1 Air', 'S1 X'] },
  { brand: 'Ather', models: ['450X', '450S', 'Rizta'] },
];

export const getBrandForModel = (modelName) => {
  const spec = PREDEFINED_BIKE_SPECS.find((s) =>
    s.models.some((m) => m.toLowerCase() === modelName.toLowerCase())
  );
  return spec ? spec.brand : null;
};

export const validateBrandModelMatch = (brand, model) => {
  const correctBrand = getBrandForModel(model);
  if (!correctBrand) return true;
  return correctBrand.toLowerCase() === brand.toLowerCase();
};
