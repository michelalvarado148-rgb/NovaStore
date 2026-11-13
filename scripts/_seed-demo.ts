import { getCategories } from '../src/lib/catalog';
import { saveCategory, saveProduct } from '../src/lib/admin';

const juegos = getCategories().find((c) => c.slug === 'juegos');
if (!juegos) throw new Error('no existe Juegos');
const ff = saveCategory({ name: 'Free Fire', description: 'Diamantes, pases y cuentas', imageUrl: '/images/categories/juegos.svg', position: 1, isActive: true, parentId: juegos.id });
if (!ff.ok) throw new Error(ff.error);
const dia = saveCategory({ name: 'Diamantes', description: 'Recargas de diamantes', imageUrl: '/images/categories/juegos.svg', position: 1, isActive: true, parentId: ff.id });
if (!dia.ok) throw new Error(dia.error);
const sen = saveCategory({ name: 'Sensibilidades', description: 'Configuraciones', imageUrl: null, position: 2, isActive: true, parentId: ff.id });
if (!sen.ok) throw new Error(sen.error);
const rob = saveCategory({ name: 'Roblox', description: 'Robux y cuentas', imageUrl: null, position: 2, isActive: true, parentId: juegos.id });
if (!rob.ok) throw new Error(rob.error);
const prod = saveProduct({ name: 'Diamantes Free Fire 100', description: 'Paquete de 100 diamantes', categoryId: dia.id, imageUrl: '/images/categories/juegos.svg', priceCents: 1500, comparePriceCents: null, stock: 25, isActive: true, variants: [] } as never);
if (!prod.ok) throw new Error(prod.error);
console.log('sembrado OK', { ff: ff.id, dia: dia.id, sen: sen.id, rob: rob.id, prod: prod.id });
