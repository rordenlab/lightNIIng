# Web Apps

Many of the tools we build are compact, robust, and modular. Combined in a thin browser-based interface, they make capable neuroimaging workflows available without a desktop installation or a remote compute service.

These applications run locally in the browser using WebAssembly and, where useful, WebGPU. Your data stays on your device: the computation uses your own CPU and graphics hardware rather than uploading sensitive images to a server.

## Built from interoperable pieces

Small, focused tools can be combined into workflows that are easier to inspect, adapt, and deploy. The dwi2trx pipeline illustrates that approach: a lightweight wrapper connects proven tools for conversion, brain extraction, image processing, visualization, and tractography.

<button class="webapps-modularity" type="button" data-lightbox-src="dwi2trx-transparent.png" data-lightbox-alt="A modular browser-based diffusion MRI workflow from raw data to tractography" aria-label="Enlarge the modular dwi2trx workflow illustration">
  <img src="dwi2trx-transparent.png" width="1264" height="847" alt="" loading="lazy" decoding="async" />
  <span>Composable tools, one local workflow · click to enlarge</span>
</button>

## Explore the apps

<div class="webapp-directory">
  <a href="https://brain2print.org/"><strong>brain2print</strong><span>Segment NIfTI images and create printable 3D brain meshes in the browser.</span></a>
  <a href="https://brainchop.org/"><strong>brainchop</strong><span>AI-powered brain segmentation that runs on local images in the browser.</span></a>
  <a href="https://browserqc.org/"><strong>browserQC</strong><span>Review neuroimaging data and support quality-control decisions in the browser.</span></a>
  <a href="https://calmar.neurodesk.org/"><strong>CALMaR</strong><span>Automated stroke-lesion mapping, connectivity analysis, and reporting.</span></a>
  <a href="https://niivue.github.io/deface/"><strong>Deface</strong><span>Remove facial features from structural images before sharing.</span></a>
  <a href="https://dicompare.neurodesk.org/"><strong>dicompare</strong><span>Compare, validate, and share DICOM acquisition protocols across sites.</span></a>
  <a href="https://tee-ar-ex.github.io/dwi2trx/"><strong>dwi2trx</strong><span>Prepare diffusion MRI tractography for interactive exploration and 3D output.</span></a>
  <a href="https://thomshaw92.github.io/Easy-MP2RAGE-T1-Map/"><strong>Easy MP2RAGE T1 Map</strong><span>Create quantitative T1 maps from MP2RAGE acquisitions.</span></a>
  <a href="https://www.edgereg.org/"><strong>EdgeReg</strong><span>Perform local rigid and affine MRI registration directly in your browser.</span></a>
  <a href="https://musclemap.neurodesk.org/"><strong>MuscleMap</strong><span>Segment and review whole-body or regional muscle MRI data.</span></a>
  <a href="https://neurodesk.org/edu/examples/functional_imaging/AFNI_preprocessing_only.html"><strong>NeurodeskEDU</strong><span>Learn reproducible AFNI functional-imaging preprocessing through an interactive example.</span></a>
  <a href="https://niivue.github.io/niivue-niimath/"><strong>niimath</strong><span>Run compact image-processing commands with an interactive local viewer.</span></a>
  <a href="https://niivue.github.io/niinav/"><strong>niiNav</strong><span>Explore neuroimaging volumes and surfaces with a lightweight web viewer.</span></a>
  <a href="https://qmrlab.org/qmrust/app/"><strong>qMRust</strong><span>Use quantitative MRI methods from qMRLab in a browser-native app.</span></a>
  <a href="https://qsmbly.neurodesk.org/"><strong>QSMbly</strong><span>Run a guided quantitative susceptibility mapping workflow from DICOM or NIfTI data.</span></a>
  <a href="https://seedseg.neurodesk.org/"><strong>SeedSeg</strong><span>Segment intraprostatic gold fiducial markers in prostate MRI.</span></a>
  <a href="https://sct.neurodesk.org/"><strong>Spinal Cord Toolbox</strong><span>Use browser-based spinal cord MRI segmentation workflows.</span></a>
  <a href="https://vesselboost.neurodesk.org/"><strong>VesselBoost</strong><span>Segment blood vessels from MRI angiography with guided local inference.</span></a>
</div>

## References

- [brain2print](https://pubmed.ncbi.nlm.nih.gov/40325035/) is described as a browser-based workflow for preparing neuroimaging data for 3D printing.
- Masoud et al. [(2023)](https://joss.theoj.org/papers/10.21105/joss.05098) describe Brainchop, an in-browser MRI segmentation and rendering application.
- [niimath](https://pubmed.ncbi.nlm.nih.gov/39268148/) provides compact, high-performance neuroimaging image processing.
- Dörig et al. [(2026)](https://apertureneuro.org/article/160858-developing-an-interactive-neuroimaging-education-resource-with-neurodesk) describe NeurodeskEDU, an interactive and reproducible neuroimaging education resource.
