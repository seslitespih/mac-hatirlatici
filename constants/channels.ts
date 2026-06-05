export interface Channel {
  id: string;
  name: string;
  number?: number;
  country: string;
  color: string;
}

export const CHANNELS: Channel[] = [
  { id: 'trt_spor', name: 'TRT Spor', number: 73, country: 'Turkey', color: '#E30A17' },
  { id: 'trt_spor2', name: 'TRT Spor 2', number: 74, country: 'Turkey', color: '#E30A17' },
  { id: 'tv8', name: 'TV8', number: 8, country: 'Turkey', color: '#FF6B00' },
  { id: 'bein1', name: 'beIN Sports 1', number: 100, country: 'Turkey', color: '#8B0000' },
  { id: 'bein2', name: 'beIN Sports 2', number: 101, country: 'Turkey', color: '#8B0000' },
  { id: 'bein3', name: 'beIN Sports 3', number: 102, country: 'Turkey', color: '#8B0000' },
  { id: 'bein4', name: 'beIN Sports 4', number: 103, country: 'Turkey', color: '#8B0000' },
  { id: 'bein_max', name: 'beIN Sports MAX', number: 104, country: 'Turkey', color: '#6B0000' },
  { id: 's_sport', name: 'S Sport', number: 110, country: 'Turkey', color: '#0033CC' },
  { id: 's_sport2', name: 'S Sport 2', number: 111, country: 'Turkey', color: '#0033CC' },
  { id: 'a_spor', name: 'A Spor', number: 50, country: 'Turkey', color: '#FF0000' },
  { id: 'exxen_spor', name: 'Exxen Spor', number: 200, country: 'Turkey', color: '#FF6B00' },
  { id: 'youtube', name: 'YouTube', country: 'World', color: '#FF0000' },
  { id: 'dazn', name: 'DAZN', country: 'World', color: '#000000' },
  { id: 'sky_sports', name: 'Sky Sports', country: 'England', color: '#009DDC' },
  { id: 'sky_sports2', name: 'Sky Sports 2', country: 'England', color: '#009DDC' },
  { id: 'bbc_sport', name: 'BBC Sport', country: 'England', color: '#BB1919' },
  { id: 'itv4', name: 'ITV4', country: 'England', color: '#003087' },
  { id: 'canal_plus', name: 'Canal+', country: 'France', color: '#000000' },
  { id: 'movistar', name: 'Movistar+', country: 'Spain', color: '#00B4E6' },
  { id: 'dazn_es', name: 'DAZN España', country: 'Spain', color: '#000000' },
  { id: 'sport1', name: 'SPORT1', country: 'Germany', color: '#FF0000' },
  { id: 'ard', name: 'ARD', country: 'Germany', color: '#003F7F' },
  { id: 'dazn_de', name: 'DAZN Deutschland', country: 'Germany', color: '#000000' },
  { id: 'rai_sport', name: 'Rai Sport', country: 'Italy', color: '#009246' },
  { id: 'dazn_it', name: 'DAZN Italia', country: 'Italy', color: '#000000' },
];

export const getChannelByName = (name: string): Channel | undefined =>
  CHANNELS.find((c) => c.name === name);
