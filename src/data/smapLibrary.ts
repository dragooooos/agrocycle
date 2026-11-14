/**
 * NASA SMAP document library.
 *
 * Catalogue of the SMAP PDF documentation published by NASA Earthdata
 * (SMAP "Data and Tools" / "Resources" pages) and by the NSIDC DAAC, which
 * hosts the SMAP land products linked from those pages.
 *
 * Documents marked `analysed: true` were read in full for AgroCycle; the facts
 * extracted from them live in `SMAP_FACTS` below and are used by the analysis
 * engine to interpret soil-moisture readings, accuracy and limitations.
 */

export type SmapDocKind =
  | "User guide"
  | "ATBD"
  | "Product specification"
  | "Assessment report"
  | "Ancillary / general"
  | "Validation campaign"
  | "Salinity (ocean)";

export interface SmapDocument {
  title: string;
  url: string;
  kind: SmapDocKind;
  analysed?: boolean;
}

const N = "https://nsidc.org/sites/default/files/";

const doc = (
  kind: SmapDocKind,
  title: string,
  path: string,
  analysed = false,
): SmapDocument => ({
  kind,
  title,
  url: path.startsWith("http") ? path : N + path,
  analysed,
});

export const SMAP_DOCUMENTS: SmapDocument[] = [
  // User guides
  doc("User guide", "SMAP L4 Surface & Root Zone Soil Moisture (SPL4SMAU/SMGP/SMLM) v8 User Guide", "documents/user-guide/multi_spl4smau-v008-userguide.pdf"),
  doc("User guide", "SMAP L3 Radiometer Global Daily 36 km Soil Moisture (SPL3SMP) v7 User Guide", "spl3smp-v007-userguide_0.pdf", true),
  doc("User guide", "SMAP L3 Radiometer Global Daily 36 km Soil Moisture (SPL3SMP) v4 User Guide", "documents/user-guide/spl3smp-v004-userguide.pdf"),
  doc("User guide", "SMAP Enhanced L3 Radiometer Daily 9 km Soil Moisture (SPL3SMP_E) v1 User Guide", "documents/user-guide/spl3smp_e-v001-userguide.pdf"),
  doc("User guide", "SMAP L2 Radiometer Half-Orbit 36 km Soil Moisture (SPL2SMP) v5 User Guide", "documents/user-guide/spl2smp-v005-userguide.pdf"),
  doc("User guide", "SMAP-Derived 1-km Downscaled Surface Soil Moisture (NSIDC-0779) v1 User Guide", "documents/user-guide/nsidc-0779-v001-userguide.pdf", true),
  doc("User guide", "Integrated SMAP and SMOS Soil Moisture (NSIDC-0799/0800) v1 User Guide", "documents/user-guide/multi_nsidc-0800-v001-userguide.pdf"),
  doc("User guide", "Integrated SMAP and SMOS Soil Moisture (NSIDC-0799/0800) v2 User Guide", "documents/user-guide/multi_nsidc-0800-v002-userguide.pdf"),
  doc("User guide", "SMAP Enhanced L1C Radiometer 9 km Brightness Temperatures (SPL1CTB_E) v3 User Guide", "documents/user-guide/spl1ctb_e-v003-userguide.pdf"),
  doc("User guide", "SMAP L1B Radiometer RFI and Calibration Data (SPL1BTB_RFICAL) v6 User Guide", "documents/user-guide/spl1btb_rfical-v006-userguide.pdf"),

  // ATBDs
  doc("ATBD", "Integrated SMAP and SMOS Soil Moisture ATBD v1", "documents/technical-reference/l2l3_sm_p_e_smap_smos_integrated_data_atbd_v001.pdf"),
  doc("ATBD", "SPL1AP/BTB ATBD [2016]", "smap_atbd_radiometerl1b_tb_rev-b_20150401.pdf"),
  doc("ATBD", "SPL1AP/BTB ATBD [2018]", "l1btb_atbd_revc_may2018.pdf"),
  doc("ATBD", "SPL1AP/SPL1BTB ATBD [2021]", "smap_atbd_radiometerl1b_tb_rev-d-20210527.pdf"),
  doc("ATBD", "SPL1BS0/CS0 ATBD [2012]", "documents/technical-reference/l1b_s0-l1c_s0-abtdv1.pdf"),
  doc("ATBD", "SPL1BTB ATBD [2014]", "278_l1b_tb_reva_web.pdf"),
  doc("ATBD", "SPL1BTB_E ATBD [2016]", "smap_l1b_tb_e_product_atbd_d-56287.pdf"),
  doc("ATBD", "SPL1CTB ATBD [2015]", "l1c_tb_atbd_rev_b_2015.pdf"),
  doc("ATBD", "SPL1CTB_E ATBD [2018]", "l1b-c_tb_e_atbd_revb_may2018.pdf"),
  doc("ATBD", "SPL2/3SMA ATBD [2014]", "276_l2_3_sm_a_reva_web.pdf"),
  doc("ATBD", "SPL2/3SMA ATBD [2015]", "l2263_sm_a_revb_web151031.pdf"),
  doc("ATBD", "SPL2/3SMAP ATBD [2014]", "277_l2_3_sm_ap_reva_web_0.pdf"),
  doc("ATBD", "SPL2/3SMP ATBD [2015]", "l2_sm_p_atbd_v7_sep2015-po-en.pdf"),
  doc("ATBD", "SPL2/3SMP/_E ATBD [2016]", "l2_sm_p_atbd_revision_c_dec2016_v2.pdf"),
  doc("ATBD", "SPL2/3SMP/_E ATBD [2018]", "l2_sm_p_atbd_rev_d_jun2018_auto_toc.pdf"),
  doc("ATBD", "SPL2/3SMP/_E ATBD [2019]", "l2_sm_p_atbd_rev_e_aug2019.pdf"),
  doc("ATBD", "SPL2/3SMP/_E ATBD [2020]", "atbd_spl23_smp_e_revf.pdf"),
  doc("ATBD", "SPL2/3SMP/_E ATBD [2021]", "l2_sm_p_atbd_rev_g_final_oct2021_0.pdf"),
  doc("ATBD", "SPL2SMAP_S ATBD [2019]", "spl2smap_s_atbd_2019.pdf"),
  doc("ATBD", "SPL3FTA ATBD [2014]", "274_l3_ft_a_reva_web_0.pdf"),
  doc("ATBD", "SPL3FTP/_E ATBD [2016]", "l3_ft_p_atbd_v7.pdf"),
  doc("ATBD", "SPL3FTP/_E Freeze/Thaw ATBD [2020]", "l3_ft_p_atbd_revisionc_vf.pdf", true),
  doc("ATBD", "SPL4CMDL Carbon ATBD [2014]", "271_l4_c_reva_web_0.pdf", true),
  doc("ATBD", "SPL4SMAU/SMGP/SMLM Soil Moisture ATBD [2014]", "272_l4_sm_reva_web_0.pdf"),

  // Ancillary & general
  doc("Ancillary / general", "Observation-Corrected Precipitation for SMAP L4 Soil Moisture (v6) and GEOS R21C", "reichle1344.pdf"),
  doc("Ancillary / general", "SMAP Ancillary Data Report: Crop Type [2013]", "283_041_crop_type2_0.pdf", true),
  doc("Ancillary / general", "SMAP Ancillary Data Report: Digital Elevation Model [2013]", "285_043_dig_elev_mod.pdf"),
  doc("Ancillary / general", "SMAP Ancillary Data Report: Landcover [2013]", "284_042_landcover_0_0.pdf"),
  doc("Ancillary / general", "SMAP Ancillary Data Report: Landcover Classification [2013]", "284_042_landcover.pdf"),
  doc("Ancillary / general", "SMAP Ancillary Data Report: Permanent Ice [2013]", "290_048_perm_ice.pdf"),
  doc("Ancillary / general", "SMAP Ancillary Data Report: Precipitation [2013]", "291_049_precip.pdf"),
  doc("Ancillary / general", "SMAP Ancillary Data Report: Soil Attributes [2020]", "soilancillaryreport_verb_aug2020.pdf", true),
  doc("Ancillary / general", "SMAP Ancillary Data Report: Static Water Fraction [2013]", "287_045_water_frac.pdf"),
  doc("Ancillary / general", "SMAP Ancillary Data Report: Surface Temperature [2015]", "293_051_surf_temp_150304.pdf"),
  doc("Ancillary / general", "SMAP Ancillary Data Report: Urban Area [2013]", "288_046_urban_area_v11.pdf"),
  doc("Ancillary / general", "SMAP Ancillary Data Report: Vegetation Water Content [2013]", "289_047_veg_water.pdf"),
  doc("Ancillary / general", "SMAP Ancillary File Read Me", "smap_anc_l1l3l4.pdf"),
  doc("Ancillary / general", "SMAP Handbook [2014]", "smap_handbook_final_1_july_2014_web.pdf", true),
  doc("Ancillary / general", "SMAP Post-Recovery Advisory Note, 23 July 2019", "smap20post-recovery20advisory20note.pdf"),

  // Assessment reports
  doc("Assessment report", "Assessment of SMAP L4 Surface & Root-Zone Soil Moisture Using In Situ Measurements", "jhm-d-17-00631_0.pdf"),
  doc("Assessment report", "Global Assessment of SMAP L4 Soil Moisture Using Assimilation Diagnostics", "jhm-d-17-01301.pdf"),
  doc("Assessment report", "SPL1B/CTB Assessment Report v1 [2015]", "l1b-l1c-beta-report.pdf"),
  doc("Assessment report", "SPL1B/CTB Assessment Report v2 [2015]", "smap20l1b_tb20validated20release20assessment20report20final.pdf"),
  doc("Assessment report", "SPL1B/CTB/_E Assessment Report v3 [2016]", "d5629520smap20l1c_tb_e20assessment20report.pdf"),
  doc("Assessment report", "SPL1B/CTB/_E Assessment Report v4 [2018]", "smap_l1_assessment20report2020180601_v9.pdf"),
  doc("Assessment report", "SPL1B/CTB/_E Assessment Report v5/5/3 [2020]", "smap_l1_assessment_report_20200808_v4_urs.pdf"),
  doc("Assessment report", "SPL2/3SMA Assessment Report v1 [2015]", "l2l3sma_assessment_report151024.pdf"),
  doc("Assessment report", "SPL2/3SMA Assessment Report v4 [2017]", "l2sma_assessment_report170630.pdf"),
  doc("Assessment report", "SPL2/3SMAP Assessment Report v1 [2015]", "smap-ap_assessment_report_final.pdf"),
  doc("Assessment report", "SPL2/3SMAP Assessment Report v2 [2016]", "smap-ap_validatedrelease_assessment_report.pdf"),
  doc("Assessment report", "SPL2/3SMP Assessment Report v2 [2015]", "smap20l2_sm_p20beta-level20assessment20report20final.pdf"),
  doc("Assessment report", "SPL2/3SMP Assessment Report v3 [2016]", "l2smp20version20320report2028final292.pdf"),
  doc("Assessment report", "SPL2/3SMP/_E Assessment Report v4 [2017]", "d5629720smap20l2_sm_p_e20assessment20report20v2.pdf"),
  doc("Assessment report", "SPL2/3SMP/_E Assessment Report v5 [2018]", "l2smpe_asmt_rpt_eopm_v5c_jun2018.pdf"),
  doc("Assessment report", "SPL2/3SMP/_E Assessment Report v6 [2019]", "spl23a3smp3a_e_assessment20report20version206205b20195d.pdf"),
  doc("Assessment report", "SPL2/3SMP/_E Assessment Report v7/4 [2020]", "l2_sm_p_ar_r17_aug2020_clean_final.pdf"),
  doc("Assessment report", "SPL2/3SMP/_E Assessment Report v8/5 [2021]", "l2_sm_p_ar_r18_final_oct2021.pdf", true),
  doc("Assessment report", "SPL2SMAP_S Assessment Report v1 [2017]", "smapspbetareleaseassessmentreport_11-01-2017_final.pdf"),
  doc("Assessment report", "SPL2SMAP_S Assessment Report v2 [2019]", "smapspbeta2breleaseassessmentreport_01-18-2019_final.pdf"),
  doc("Assessment report", "SPL2SMAP_S Assessment Report v3 [2020]", "smapsp_version3_releaseassessmentreport_08-21-2020_final.pdf"),
  doc("Assessment report", "SPL3FTA Assessment Report v1 [2015]", "smap20l3_ft_a20beta-level20assessment20report20final2.pdf"),
  doc("Assessment report", "SPL3FTA Assessment Report v3 [2016]", "smap20l3_ft_a20validated20assessment20report20final.pdf"),
  doc("Assessment report", "SPL3FTP/_E Assessment Report v1 [2016]", "smap20l3_ft_p5be5d20assessment20report20v7.pdf"),
  doc("Assessment report", "SPL3FTP/_E Assessment Report v2 [2018]", "smap20l3_ft_p5be5d20assessment20report20r16_final2.pdf"),
  doc("Assessment report", "SPL3FTP/_E Assessment Report v3 [2020]", "smap20l3_ft_p5be5d20assessment20report202020_reformat_v3.pdf"),
  doc("Assessment report", "SPL4CMDL Assessment Report v1 [2015]", "kimball806.pdf"),
  doc("Assessment report", "SPL4CMDL Assessment Report v2 [2016]", "smap-validation_report_l4_c_20160421.pdf"),
  doc("Assessment report", "SPL4CMDL Assessment Report v3 [2018]", "l4c_v4_releasereport_jun_2018.pdf"),
  doc("Assessment report", "SPL4CMDL Assessment Report v5 [2021]", "nasa_tm_2021_104606_vol56_kimball_et_al_l4c_v5_assessment_final.pdf"),
  doc("Assessment report", "SPL4CMDL Assessment Report v6 [2022]", "nasa20tm2020222010460620vol2061.pdf"),
  doc("Assessment report", "SPL4SMAU/SMGP/SMLM Assessment Report v1 [2015]", "reichle788.pdf"),
  doc("Assessment report", "SPL4SMAU/SMGP/SMLM Assessment Report v2 [2016]", "reichle851.pdf"),
  doc("Assessment report", "SPL4SMAU/SMGP/SMLM Assessment Report v3 [2018]", "smap20assessment20report.pdf"),
  doc("Assessment report", "SPL4SMAU/SMGP/SMLM Assessment Report v5 [2021]", "tm-2021-104606_vol_58_smap_l4_sm_version_5_release_assessment_report_final-_v4.pdf"),
  doc("Assessment report", "SPL4SMAU/SMGP/SMLM Assessment Report v6 [2022]", "smap_l4_sm_version_6_assessmentreport.pdf"),
  doc("Assessment report", "SPL4SMAU/SMGP/SMLM Assessment Report v7 [2023]", "documents/technical-reference/smap_l4v7_sm_assessmtreport.pdf", true),

  // Product specification documents
  doc("Product specification", "SPL1AP PSD v1 [2015]", "d-92340-a_smap_radiometer_level1a_product_specification_document_150720_with20sigs.pdf"),
  doc("Product specification", "SPL1BTB PSD v1 [2015]", "smap_radiometer_level_1b_tb_pds_150720_with20sigs.pdf"),
  doc("Product specification", "SPL1BTB PSD v2 [2016]", "smap_radiometer_level_1b_tb_product20specification20document_1805b15d.pdf"),
  doc("Product specification", "SPL1BTB_RFICAL PSD v1", "documents/technical-reference/smap_radiometer_rfical_productspecification.pdf"),
  doc("Product specification", "SPL1CTB PSD v1 [2015]", "d-725452c20smap20l1c_tb20product20specification20document20with20sigs.pdf"),
  doc("Product specification", "SPL1CTB PSD v4 [2018]", "d7254520smap20l1c_tb20psd20version204_0.pdf"),
  doc("Product specification", "SPL1CTB PSD v5 [2020]", "psd_spl1ctb_v5.pdf"),
  doc("Product specification", "SPL1CTB_E PSD v1 [2016]", "d5629020smap20l1c_tb_e20psd20version201.pdf"),
  doc("Product specification", "SPL1CTB_E PSD v2 [2018]", "d5629020smap20l1c_tb_e20psd20version202.pdf"),
  doc("Product specification", "SPL1CTB_E PSD v3 [2020]", "psd_spl1ctb_e_v3.pdf"),
  doc("Product specification", "SPL2SMA PSD v1 [2014]", "d-72546_smap_20l2_sm_a_psd_12082015_wo-sigs.pdf"),
  doc("Product specification", "SPL2SMA PSD v2 [2016]", "d-72546_smap_20l2_sm_a_psd_04162016_wo-sigs.pdf"),
  doc("Product specification", "SPL2SMAP PSD v1 [2015]", "smap20l2_sm_ap20psd_10312015.pdf"),
  doc("Product specification", "SPL2SMAP_S PSD v1 [2017]", "smap20l2_sm_sp20psd_11-01-2017_latest.pdf"),
  doc("Product specification", "SPL2SMAP_S PSD v2 [2018]", "smap20l2_sm_sp20psd_20180531.pdf"),
  doc("Product specification", "SPL2SMAP_S PSD v3 [2020]", "psd_spl2smap_s_v3.pdf"),
  doc("Product specification", "SPL2SMP PSD [2021]", "d7254720smap20l2_sm_p20psd20_version2080_final.pdf"),
  doc("Product specification", "SPL2SMP PSD v1 [2015]", "smap20l2_sm_p20beta-level20psd2028primary29.pdf"),
  doc("Product specification", "SPL2SMP PSD v2 [2018]", "d7254720smap20l2_sm_p20psd20version2051.pdf"),
  doc("Product specification", "SPL2SMP PSD v3 [2019]", "d7254720smap20l2_sm_p20psd20version2031.pdf"),
  doc("Product specification", "SPL2SMP PSD v7 [2020]", "psd_spl2smp_v7.pdf"),
  doc("Product specification", "SPL2SMP_E PSD [2021]", "d5629120smap20l2_sm_p_e20psd_version2050_final.pdf"),
  doc("Product specification", "SPL2SMP_E PSD v1 [2016]", "d5629120smap20l2_sm_p_e20psd20version201.pdf"),
  doc("Product specification", "SPL2SMP_E PSD v2 [2018]", "d5629120smap20l2_sm_p_e20psd20version2021.pdf"),
  doc("Product specification", "SPL2SMP_E PSD v3 [2019]", "d5629120smap20l2_sm_p_e20psd2030.pdf"),
  doc("Product specification", "SPL2SMP_E PSD v4 [2020]", "psd_spl2smp_e_v4.pdf"),
  doc("Product specification", "SPL3FTA PSD v1 [2015]", "d-72549_smap20l3_ft_a20psd_10122015_wo-sigs.pdf"),
  doc("Product specification", "SPL3FTP PSD [2018]", "d-56293_smap20l3_ft_p20psd_05312018.pdf"),
  doc("Product specification", "SPL3FTP PSD v1 [2016]", "d-56293_smap20l3_ft_p20psd_11152016.pdf"),
  doc("Product specification", "SPL3FTP_E PSD [2018]", "d-56294_smap20l3_ft_p_e20psd_05312018.pdf"),
  doc("Product specification", "SPL3FTP_E PSD v1 [2016]", "d-56294_smap20l3_ft_p_e20psd_11152016.pdf"),
  doc("Product specification", "SPL3SMA PSD v1 [2014]", "d-72550_smap20l3_sm_a20psd_12082015_wo-sigs.pdf"),
  doc("Product specification", "SPL3SMA PSD v2 [2016]", "d-72550_smap20l3_sm_a20psd_04162016_wo-sigs.pdf"),
  doc("Product specification", "SPL3SMAP PSD v1 [2015]", "smap20l3_sm_ap20psd_10312015.pdf"),
  doc("Product specification", "SPL3SMP PSD [2021]", "d7255120smap20l3_sm_p20psd_version2080_final.pdf"),
  doc("Product specification", "SPL3SMP PSD v1 [2015]", "smap20l3_sm_p20beta-level20psd2028primary29.pdf"),
  doc("Product specification", "SPL3SMP PSD v2 [2018]", "d7255120smap20l3_sm_p20psd20version2051.pdf"),
  doc("Product specification", "SPL3SMP PSD v3 [2019]", "d7255120smap20l3_sm_p20psd20version2030.pdf"),
  doc("Product specification", "SPL3SMP PSD v7 [2020]", "psd_spl3smp_v7.pdf"),
  doc("Product specification", "SPL3SMP_E PSD [2021]", "d5629220smap20l3_sm_p_e20psd_version2050_final.pdf"),
  doc("Product specification", "SPL3SMP_E PSD v1 [2016]", "d5629220smap20l3_sm_p_e20psd20version201_0.pdf"),
  doc("Product specification", "SPL3SMP_E PSD v2 [2018]", "d5629220smap20l3_sm_p_e20psd20version2021.pdf"),
  doc("Product specification", "SPL3SMP_E PSD v3 [2019]", "d5629220smap20l3_sm_p_e20psd20version2030.pdf"),
  doc("Product specification", "SPL3SMP_E PSD v4 [2020]", "psd_spl3smp_e_v4.pdf"),
  doc("Product specification", "SPL4CMDL PSD v2 [2016]", "smap_l4c_psd_v2_0_20160421.pdf"),
  doc("Product specification", "SPL4CMDL PSD v2.1 [2021]", "smap_l4c_psd_v2_1_20211115.pdf"),
  doc("Product specification", "SPL4CMDL PSD v7 [2022]", "documents/technical-reference/ref-endsley-et-al-2022-l4c-psd-v22-final.pdf"),
  doc("Product specification", "SPL4SMAU/SMGP/SMLM PSD v1 [2015]", "reichle789.pdf"),
  doc("Product specification", "SPL4SMAU/SMGP/SMLM PSD v2 [2018]", "smap_l4_sm_psd_v15_for_l4sm_version_4_final.pdf"),
  doc("Product specification", "SPL4SMAU/SMGP/SMLM PSD v7 [2022]", "documents/technical-reference/reichle1438.pdf"),
  doc("Product specification", "SPL4SMAU/SMGP/SMLM PSD v8 [2025]", "documents/technical-reference/smap_l4_sm_psd_v17_for_l4sm_version_8.pdf", true),

  // Validation campaigns
  doc("Validation campaign", "CLASIC07 Science and Implementation Plan", "clasic20200720implementation20plan.pdf"),
  doc("Validation campaign", "SMAPVEX08 Experiment Plan", "smapvex0820experiment20plan.pdf"),
  doc("Validation campaign", "SMAPVEX12 Database Report", "smapvex12-database-report-final.pdf"),
  doc("Validation campaign", "SMAPVEX12 Experiment Plan", "smapvex12_experiment_plan.pdf"),
  doc("Validation campaign", "SMAPVEX16 Manitoba Experiment Plan", "smapvex16_experimentplan_0.pdf"),
  doc("Validation campaign", "SV15M Crop LAI Product Specifications", "iso_19131_croplai.pdf"),
  doc("Validation campaign", "SV16M Crop Density Product Specifications", "iso_19131_cropdensity.pdf"),
  doc("Validation campaign", "SV16M Crop Height Product Specifications", "iso_19131_cropheight.pdf"),
  doc("Validation campaign", "SV16M CropScan Product Specifications", "iso_19131_cropscan.pdf"),
  doc("Validation campaign", "SV16M ECCC Radiometer Angular Product Specifications", "iso_19131_ecradiometerangular_0.pdf"),
  doc("Validation campaign", "SV16M ECCC Radiometer Continuous Product Specifications", "iso_19131_ecradiometerangular.pdf"),
  doc("Validation campaign", "SV16M MA Weather Station Product Specifications", "iso_19131_maweatherstations.pdf"),
  doc("Validation campaign", "SV16M POGO Soil Moisture Product Specifications", "iso_19131_soilmoisturehandheld.pdf"),
  doc("Validation campaign", "SV16M RISM Soil Station Product Specifications", "iso_19131_risma.pdf"),
  doc("Validation campaign", "SV16M Soil and Crop Temperature Product Specifications", "iso_19131_soilcroptemp.pdf"),
  doc("Validation campaign", "SV16M Soil Properties Product Specifications", "iso_19131_soilproperties.pdf"),
  doc("Validation campaign", "SV16M Soil Roughness Product Specifications", "iso_19131_soilroughness.pdf"),
  doc("Validation campaign", "SV16M Temporary Soil Moisture Station Product Specifications", "iso_19131_tempsoilstations.pdf"),
  doc("Validation campaign", "SV16M US Radiometer Angular Product Specifications", "iso_19131_usradiometerangular.pdf"),
  doc("Validation campaign", "SV16M US Radiometer Continuous Product Specifications", "iso_19131_usradiometercontinuous.pdf"),
  doc("Validation campaign", "SV16M Volumetric Soil Moisture Product Specifications", "iso_19131_volumetricsoilmoisture.pdf"),

  // Earthdata SMAP "Resources" page (ocean salinity; catalogued, not used for crops)
  doc("Salinity (ocean)", "NASA/RSS SMAP Salinity: Version 5.0 Validated Release", "https://earthdata.nasa.gov/s3fs-public/2025-10/SMAP_NASA_RSS_Salinity_Release_V5.0_NRT.pdf?VersionId=oUJ1Kwgk886fgXPKDKHADJvoA.BBM1S8"),
  doc("Salinity (ocean)", "NASA/RSS SMAP Salinity: Version 6.0 Validated Release – Release Notes", "https://earthdata.nasa.gov/s3fs-public/2025-12/SMAP_Release_V6.0.pdf?VersionId=jt5u.TeDY.ZeinyU0aXUV9xnXueq.3jY"),
  doc("Salinity (ocean)", "SMAP Salinity and Wind Speed Data User Guide", "https://earthdata.nasa.gov/s3fs-public/2025-12/SMAP-SSS_JPL_V5.0_Documentation.pdf?VersionId=9U93Bvy2iVO6oHzatzay3B83wbVdaZgO"),
];

const url = (title: string) =>
  SMAP_DOCUMENTS.find((d) => d.title.startsWith(title))?.url ?? "";

/**
 * Numbers taken from the analysed SMAP PDFs. Every value carries its source
 * so the UI can show the evidence behind each interpretation.
 */
export const SMAP_FACTS = {
  surfaceDepthCm: 5,
  rootZoneDepthCm: 100,
  accuracyRequirement: 0.04, // m3/m3 ubRMSE (1-sigma)
  l4SurfaceUbRmse: 0.041, // m3/m3, core sites, 9 km, L4 v7
  l4RootZoneUbRmse: 0.026, // m3/m3, core sites, 9 km, L4 v7
  l4SurfaceR: 0.78,
  l4RootZoneR: 0.78,
  l2DcaUbRmse: 0.036, // m3/m3, L2SMP v8 36 km, AM, DCA
  l2DcaR: 0.816,
  l4GridKm: 9,
  l3GridKm: 36,
  downscaledGridKm: 1,
  vwcSensitivityLimit: 5, // kg/m2: L-band sensitive through vegetation up to ~5
  vwcSkipLimit: 30, // kg/m2: retrieval skipped above this
  slopeSdUncertain: 3, // degrees: flagged uncertain
  slopeSdSkip: 6, // degrees: retrieval skipped
  frozenFractionUncertain: 0.05,
  minValidSoilMoisture: 0.02, // m3/m3
  particleDensity: 2.65, // g/cm3, porosity = 1 - BD/2.65
  freezeThawAccuracy: 0.8,
  revisitDaysGlobal: 3,
  l4cNeeRmse: 1.6, // g C m-2 d-1
} as const;

export interface SmapEvidence {
  label: string;
  text: string;
  source: string;
  url: string;
}

export const SMAP_EVIDENCE: SmapEvidence[] = [
  {
    label: "Measured layers",
    text: "SMAP senses about the top 5 cm of soil directly. Root-zone moisture (top 1 m), the layer crops draw from, is estimated by the Level-4 product by assimilating SMAP into a land model.",
    source: "SMAP L4 PSD v8 · SPL3SMP v7 User Guide",
    url: url("SPL4SMAU/SMGP/SMLM PSD v8"),
  },
  {
    label: "Accuracy",
    text: "Mission requirement: ≤ 0.04 m³/m³ ubRMSE. Validated L4 v7 at core sites: 0.041 (surface) and 0.026 m³/m³ (root zone), R ≈ 0.78. Passive L2 (DCA): 0.036 m³/m³, R = 0.816.",
    source: "L4 v7 Assessment Report · L2/3SMP v8/5 Assessment Report",
    url: url("SPL4SMAU/SMGP/SMLM Assessment Report v7"),
  },
  {
    label: "Spatial scale",
    text: "SMAP grids are 36 km (L2/L3), 9 km (enhanced, L4) and 1 km (downscaled). A single field is far smaller than one pixel, so readings describe the surrounding landscape, not your exact plot.",
    source: "SPL3SMP v7 User Guide · NSIDC-0779 User Guide",
    url: url("SMAP-Derived 1-km"),
  },
  {
    label: "Dense vegetation",
    text: "L-band signals pass through vegetation up to ~5 kg/m² water content; above that retrievals are flagged uncertain and above 30 kg/m² they are skipped.",
    source: "SPL3SMP v7 User Guide · SMAP Handbook",
    url: url("SMAP L3 Radiometer Global Daily 36 km Soil Moisture (SPL3SMP) v7"),
  },
  {
    label: "Terrain & frozen soil",
    text: "Slope variability above 3° is flagged uncertain and above 6° is skipped; frozen ground or snow above 5% of a cell also degrades retrievals.",
    source: "SPL3SMP v7 User Guide",
    url: url("SMAP L3 Radiometer Global Daily 36 km Soil Moisture (SPL3SMP) v7"),
  },
  {
    label: "Soil porosity",
    text: "SMAP uses SoilGrids 250 m soil attributes and computes porosity as 1 − bulk density / 2.65. Porosity is the physical upper limit of soil moisture.",
    source: "SMAP Ancillary Report: Soil Attributes [2020]",
    url: url("SMAP Ancillary Data Report: Soil Attributes"),
  },
  {
    label: "Growing season",
    text: "Freeze/thaw timing sets the length of the growing season; the radiometer product targets 80% classification accuracy and flags AM-frozen/PM-thawed transition days.",
    source: "SPL3FTP/_E ATBD [2020] · SMAP Handbook",
    url: url("SPL3FTP/_E Freeze/Thaw ATBD"),
  },
  {
    label: "Soil carbon",
    text: "SMAP L4 Carbon limits plant productivity with root-zone soil moisture and freeze/thaw, and tracks surface (<10 cm) soil organic carbon.",
    source: "SPL4CMDL ATBD [2014]",
    url: url("SPL4CMDL Carbon ATBD"),
  },
];
